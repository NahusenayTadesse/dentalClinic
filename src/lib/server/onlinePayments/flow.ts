/**
 * Taking a payment online: asking a gateway for a checkout, finding out whether it was paid, and
 * recording the money when it was.
 *
 * **Nothing is recorded on anyone's word but the gateway's.** A checkout starts as `pending` and
 * touches no bill. It becomes a payment only when the gateway, asked directly by this server,
 * says the money arrived and the amount is the amount asked. The desk's Check button, the gateway's
 * notification and the scheduled check all do the same thing — ask — so a forged notification can
 * at most make the server ask a question whose answer is no.
 *
 * **Once, however often it is asked.** The online payment's row is locked while its answer is
 * applied, and the payment it becomes carries our reference as its unique `gateway_txn_token`, so a
 * notification that arrives while the desk presses Check records one payment, not two.
 *
 * **The bills may have moved on.** Between the link being sent and the patient paying it, the desk
 * may have taken cash for the same bill. Money that has arrived is still money: each bill takes
 * what it still owes, and what is left becomes credit on the patient's account
 * (`server/deposits.ts`), where the next bill can use it or a refund can return it.
 *
 * **The network is never inside a transaction.** Each step asks the gateway first and writes after,
 * in a short transaction of its own — a gateway can take seconds, and a lock held across it blocks
 * the desk.
 *
 * Non-goals: payments by an employer or insurer (they pay by transfer), deposits taken online, and
 * refunds through the gateway — a refund goes back through the Refunds queue like any other.
 */
import { randomBytes } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { invoice, onlinePayment, patient, paymentGateway } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { WriteRefused, refuseUnless } from '$lib/server/childCrud';
import { billingRefusals } from '$lib/server/cashDrawer';
import { paidOn, takePayment, type OnlineConfirmation } from '$lib/server/payments';
import { takeDeposit } from '$lib/server/deposits';
import { canPay, cents } from '$lib/invoiceStatus';
import { GATEWAY_INFO } from '$lib/paymentGateways';
import { startCheckout, verifyCheckout } from '$lib/server/payGateways';
import type { VerifyResult } from '$lib/server/payGateways/types';
import { credentialsFor } from './accounts';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | Tx;

/** A checkout not paid within a day is given up on; the gateways' own links lapse sooner. */
export const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000;

/** The same payment is not asked about twice within this — the desk polls while it waits. */
const ASK_GAP_MS = 4_000;

/** A request with no one signed in: a gateway's notification, the scheduled check. */
export function systemEvent(branchId: number | null): AuditRequest {
	return {
		locals: { user: null, branch: { active: branchId } },
		getClientAddress: () => 'gateway'
	};
}

/**
 * Our reference for a new checkout: `DC` and sixteen letters and digits. Letters and digits only,
 * because that is the one alphabet every gateway accepts in its order id.
 */
export function newReference(): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const bytes = randomBytes(16);
	return 'DC' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** An amount to each bill, as the form posts it. */
type Allocation = { invoiceId: number; amount: number };

/**
 * The allocations, checked against the bills: the patient's, payable, and not more than each still
 * owes. With a transaction, the bills are locked, so the check holds until the row is written.
 * Returns the cleaned allocations and the bills' numbers.
 */
async function checkedAllocations(
	reader: Reader,
	say: ReturnType<typeof billingRefusals>,
	patientId: number,
	raw: Allocation[],
	lock: boolean
) {
	const allocations = raw
		.map((a) => ({ invoiceId: a.invoiceId, amount: cents(a.amount) }))
		.filter((a) => a.amount > 0);
	refuseUnless(allocations.length > 0, say.enterAmount);
	refuseUnless(
		new Set(allocations.map((a) => a.invoiceId)).size === allocations.length,
		say.billTwice
	);

	const query = reader
		.select()
		.from(invoice)
		.where(
			and(
				inArray(
					invoice.id,
					allocations.map((a) => a.invoiceId)
				),
				eq(invoice.patientId, patientId),
				notDeleted(invoice)
			)
		);
	const bills = lock ? await query.for('update') : await query;
	const numbers: string[] = [];
	for (const a of allocations) {
		const bill = bills.find((b) => b.id === a.invoiceId);
		if (!bill) throw new WriteRefused(null, 'That bill is not on this patient’s record.');
		refuseUnless(
			canPay(bill.status, bill.approvalStatus),
			bill.approvalStatus === 'pending'
				? say.billWaiting(bill.invoiceNumber ?? '')
				: say.billCannotPay(bill.invoiceNumber ?? '')
		);
		const owed = cents(bill.total - (await paidOn(reader, bill.id)));
		refuseUnless(a.amount <= owed + 0.005, say.moreThanOwed(bill.invoiceNumber ?? '', owed));
		numbers.push(bill.invoiceNumber ?? '');
	}
	return { allocations, numbers };
}

/** What starting an online payment needs. `origin` is this server's, for the gateway's links back. */
export type StartInput = {
	patientId: number;
	gatewayId: number;
	allocations: Allocation[];
	phone: string | null;
	origin: string;
	branchId: number | null;
};

/**
 * Asks the gateway for a checkout, and returns the write that records it. The bills are checked
 * before the gateway is asked — so a refused amount never becomes a link — and again, locked, in
 * the write. A refusal from either comes back as the write throwing `WriteRefused`, which is how
 * `formAction` shows it on the form.
 */
export async function prepareOnlinePayment(
	event: AuditRequest,
	input: StartInput,
	fetcher: typeof fetch = fetch
): Promise<(tx: Tx) => Promise<{ id: number; checkoutUrl: string }>> {
	const say = billingRefusals(event);
	try {
		const [account] = await db
			.select({ id: paymentGateway.id })
			.from(paymentGateway)
			.where(
				and(
					eq(paymentGateway.id, input.gatewayId),
					eq(paymentGateway.enabled, true),
					notDeleted(paymentGateway)
				)
			)
			.limit(1);
		if (!account) throw new WriteRefused('gatewayId', 'That gateway is not switched on.');
		const { allocations, numbers } = await checkedAllocations(
			db,
			say,
			input.patientId,
			input.allocations,
			false
		);
		const [who] = await db
			.select({ name: patient.name, fatherName: patient.fatherName })
			.from(patient)
			.where(eq(patient.id, input.patientId))
			.limit(1);
		const keys = await credentialsFor(db, input.gatewayId);
		if (!keys.ok) throw new WriteRefused('gatewayId', keys.error);

		const reference = newReference();
		const amount = cents(allocations.reduce((sum, a) => sum + a.amount, 0));
		const back = `${input.origin}/paid?ref=${reference}`;
		const started = await startCheckout(
			keys.provider,
			keys.credentials,
			{
				reference,
				amount,
				phone: input.phone,
				firstName: who?.name ?? 'Patient',
				lastName: who?.fatherName ?? 'Patient',
				title: `Bill ${numbers.filter(Boolean).join(', ')}`.slice(0, 60),
				returnUrl: back,
				cancelUrl: `${back}&cancelled=1`,
				notifyUrl: `${input.origin}/api/payments/${keys.provider}`
			},
			fetcher
		);
		if (!started.ok) throw new WriteRefused('gatewayId', started.error);

		return async (tx) => {
			await checkedAllocations(tx, say, input.patientId, allocations, true);
			const id = await insertReturningId(tx, onlinePayment, {
				gatewayId: input.gatewayId,
				provider: keys.provider,
				reference,
				patientId: input.patientId,
				amount,
				allocations,
				phone: input.phone,
				checkoutUrl: started.checkoutUrl.slice(0, 1024),
				sessionId: started.sessionId,
				branchId: input.branchId ?? undefined,
				createdBy: event.locals.user?.id
			});
			await recordAudit(tx, event, { table: 'online_payment', recordId: id, action: 'create' });
			return { id, checkoutUrl: started.checkoutUrl };
		};
	} catch (err: unknown) {
		if (err instanceof WriteRefused) {
			return async () => {
				throw err;
			};
		}
		throw err;
	}
}

/** What the gateway said, with what is needed to act on it. Null when there was nothing to ask. */
export type GatewayAnswer = {
	id: number;
	result: VerifyResult;
	paymentMethodId: number | null;
};

/**
 * Asks the gateway about one online payment — when it is still waiting, or was given up on at the
 * desk (the patient may have paid the link anyway). Network only; `applyAnswer` writes.
 */
export async function askGateway(
	id: number,
	fetcher: typeof fetch = fetch,
	reader: Reader = db
): Promise<GatewayAnswer | null> {
	const [row] = await reader
		.select({
			gatewayId: onlinePayment.gatewayId,
			reference: onlinePayment.reference,
			sessionId: onlinePayment.sessionId,
			status: onlinePayment.status,
			checkedAt: onlinePayment.checkedAt
		})
		.from(onlinePayment)
		.where(and(eq(onlinePayment.id, id), notDeleted(onlinePayment)))
		.limit(1);
	if (!row || (row.status !== 'pending' && row.status !== 'cancelled')) return null;
	if (row.checkedAt && Date.now() - row.checkedAt.getTime() < ASK_GAP_MS) return null;

	const keys = await credentialsFor(reader, row.gatewayId);
	if (!keys.ok) return { id, result: { ok: false, error: keys.error }, paymentMethodId: null };
	const result = await verifyCheckout(
		keys.provider,
		keys.credentials,
		{ reference: row.reference, sessionId: row.sessionId },
		fetcher
	);
	return { id, result, paymentMethodId: keys.paymentMethodId };
}

/** What became of applying an answer, for the desk. */
export type Applied = { status: 'paid' | 'pending' | 'failed' | 'cancelled'; text: string };

/**
 * Applies the gateway's answer, in the caller's transaction. A paid answer for the amount asked is
 * recorded as a payment against the bills — what they no longer owe going on as credit — and the
 * online payment marked paid. `patientId`, when given, must be the payment's patient: the desk
 * acts on one patient's chart.
 */
export async function applyAnswer(
	tx: Tx,
	event: AuditRequest,
	answer: GatewayAnswer,
	patientId?: number
): Promise<Applied> {
	const [row] = await tx
		.select()
		.from(onlinePayment)
		.where(and(eq(onlinePayment.id, answer.id), notDeleted(onlinePayment)))
		.limit(1)
		.for('update');
	if (!row || (patientId !== undefined && row.patientId !== patientId)) {
		throw new WriteRefused(null, 'That online payment is not on this patient’s record.');
	}
	if (row.status === 'paid' || row.status === 'failed') {
		return { status: row.status, text: describe(row.status, row.error) };
	}

	const now = new Date();
	const result = answer.result;
	if (!result.ok) {
		await tx
			.update(onlinePayment)
			.set({ checkedAt: now, error: result.error.slice(0, 255) })
			.where(eq(onlinePayment.id, row.id));
		return {
			status: row.status,
			text: `Could not ask ${GATEWAY_INFO[row.provider].name}: ${result.error}`
		};
	}

	const base = { checkedAt: now, providerStatus: result.providerStatus?.slice(0, 50) ?? null };
	let next: Applied['status'] = row.status;
	let error: string | null = null;
	if (result.state === 'paid') {
		const short = result.amount !== null && Math.abs(result.amount - row.amount) > 0.005;
		const foreign = result.currency !== null && result.currency.toUpperCase() !== 'ETB';
		if (short || foreign) {
			next = 'failed';
			error = `${GATEWAY_INFO[row.provider].name} reports ${result.amount ?? '?'} ${result.currency ?? ''} paid against ${row.amount} ETB asked. Check it with the gateway and record it by hand.`;
		} else if (answer.paymentMethodId === null) {
			throw new WriteRefused(null, 'The gateway account could not be read.');
		} else {
			const transactionId = await recordMoney(tx, event, row, answer.paymentMethodId, result);
			await tx
				.update(onlinePayment)
				.set({
					...base,
					status: 'paid',
					paidAt: now,
					transactionId,
					providerReference: result.providerReference?.slice(0, 128) ?? null,
					error: null
				})
				.where(eq(onlinePayment.id, row.id));
			await recordAudit(tx, event, {
				table: 'online_payment',
				recordId: row.id,
				action: 'update',
				before: { status: row.status },
				after: { status: 'paid' }
			});
			return { status: 'paid', text: describe('paid', null) };
		}
	} else if (result.state === 'failed' && row.status === 'pending') {
		next = 'failed';
		error = `${GATEWAY_INFO[row.provider].name} says it was not paid.`;
	} else if (
		row.status === 'pending' &&
		now.getTime() - row.createdAt.getTime() > GIVE_UP_AFTER_MS
	) {
		next = 'failed';
		error = 'Not paid within a day. Start a new one if the patient still wants to pay online.';
	}

	await tx
		.update(onlinePayment)
		.set({ ...base, status: next, error })
		.where(eq(onlinePayment.id, row.id));
	if (next !== row.status) {
		await recordAudit(tx, event, {
			table: 'online_payment',
			recordId: row.id,
			action: 'update',
			before: { status: row.status },
			after: { status: next }
		});
	}
	return { status: next, text: describe(next, error) };
}

/** A status as the desk reads it. */
function describe(status: Applied['status'], error: string | null): string {
	return {
		paid: 'Paid — the payment is recorded and its receipt is on the bill.',
		pending: 'Not paid yet.',
		failed: error ?? 'It was not paid.',
		cancelled: 'Given up on at the desk, and not paid.'
	}[status];
}

/**
 * Records the arrived money: against each bill what it still owes, up to what was allocated to it,
 * and the rest as credit. Returns the payment's id — or the deposit's, when the bills owed nothing.
 */
async function recordMoney(
	tx: Tx,
	event: AuditRequest,
	row: typeof onlinePayment.$inferSelect,
	methodId: number,
	result: Extract<VerifyResult, { ok: true }>
): Promise<number> {
	const online: OnlineConfirmation = {
		gateway: row.provider,
		token: row.reference,
		providerReference: result.providerReference?.slice(0, 128) ?? null,
		providerStatus: result.providerStatus?.slice(0, 50) ?? null
	};

	const bills = await tx
		.select()
		.from(invoice)
		.where(
			and(
				inArray(
					invoice.id,
					row.allocations.map((a) => a.invoiceId)
				),
				eq(invoice.patientId, row.patientId),
				notDeleted(invoice)
			)
		)
		.for('update');
	const shares: Allocation[] = [];
	for (const a of row.allocations) {
		const bill = bills.find((b) => b.id === a.invoiceId);
		if (!bill || !canPay(bill.status, bill.approvalStatus)) continue;
		const owed = cents(bill.total - (await paidOn(tx, bill.id)));
		const share = cents(Math.min(a.amount, owed));
		if (share > 0) shares.push({ invoiceId: bill.id, amount: share });
	}
	const applied = cents(shares.reduce((sum, s) => sum + s.amount, 0));
	const rest = cents(row.amount - applied);

	const paymentId = shares.length
		? await takePayment(tx, event, {
				patientId: row.patientId,
				allocations: shares,
				paymentMethodId: methodId,
				branchId: row.branchId,
				reference: null,
				online
			})
		: null;
	const depositId =
		rest > 0
			? await takeDeposit(tx, event, {
					patientId: row.patientId,
					amount: rest,
					paymentMethodId: methodId,
					branchId: row.branchId,
					reference: null,
					note: `Online payment ${row.reference}: more than the bills still owed`,
					// The payment holds the reference; the credit's token is told apart from it.
					online: paymentId ? { ...online, token: `${row.reference}-CREDIT` } : online
				})
			: null;
	const id = paymentId ?? depositId;
	// An online payment is more than nothing — refused when started otherwise — so one was written.
	if (id === null) throw new Error('An online payment of nothing cannot be recorded.');
	return id;
}
