/**
 * Online payments seen from outside the payment flow itself: asking about them with nobody signed in
 * (a gateway's notification, the scheduled check), and what the desk does with one patient's list —
 * reads it, gives up on one, texts its link. The flow it calls — start, ask, apply — is `index.ts`.
 */
import { and, desc, eq, gte, inArray, or } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { onlinePayment, patient, paymentGateway, transactions } from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { refuseUnless } from '$lib/server/childCrud';
import { sendSms, type SmsOutcome } from '$lib/server/sms';
import { formatETB } from '$lib/global.svelte';
import type { PaymentGateway } from '$lib/paymentGateways';
import { referenceIn } from '$lib/server/payGateways';
import { applyAnswer, askGateway, GIVE_UP_AFTER_MS, systemEvent, type Applied } from './flow';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | Tx;

/**
 * Asks about one online payment and applies the answer — for a notification and the scheduled
 * check, which have nobody signed in. Never throws for the gateway's sake.
 */
export async function checkOnlinePayment(
	id: number,
	fetcher: typeof fetch = fetch
): Promise<Applied | null> {
	const answer = await askGateway(id, fetcher);
	if (!answer) return null;
	const [row] = await db
		.select({ branchId: onlinePayment.branchId })
		.from(onlinePayment)
		.where(eq(onlinePayment.id, id))
		.limit(1);
	return db.transaction((tx) => applyAnswer(tx, systemEvent(row?.branchId ?? null), answer));
}

/**
 * A gateway's notification: which payment it is about, then the same question the desk asks. The
 * body's claims about the payment are not read — only the reference, to know whom to ask about.
 */
export async function onNotification(provider: PaymentGateway, body: unknown): Promise<void> {
	const ref = referenceIn(provider, body);
	if (!ref) return;
	const [row] = await db
		.select({ id: onlinePayment.id })
		.from(onlinePayment)
		.where(
			and(
				eq(onlinePayment.provider, provider),
				or(eq(onlinePayment.reference, ref), eq(onlinePayment.sessionId, ref)),
				inArray(onlinePayment.status, ['pending', 'cancelled']),
				notDeleted(onlinePayment)
			)
		)
		.limit(1);
	if (row) await checkOnlinePayment(row.id);
}

/** Every payment still waiting from the last two days, asked about — the scheduled check. */
export async function checkWaiting(fetcher: typeof fetch = fetch) {
	const since = new Date(Date.now() - 2 * GIVE_UP_AFTER_MS);
	const waiting = await db
		.select({ id: onlinePayment.id })
		.from(onlinePayment)
		.where(
			and(
				eq(onlinePayment.status, 'pending'),
				gte(onlinePayment.createdAt, since),
				notDeleted(onlinePayment)
			)
		)
		.orderBy(onlinePayment.id)
		.limit(100);
	const counts = { asked: 0, paid: 0, failed: 0 };
	for (const { id } of waiting) {
		const applied = await checkOnlinePayment(id, fetcher).catch((err: unknown) => {
			console.error(`[online-payments] checking ${id} failed:`, err);
			return null;
		});
		if (!applied) continue;
		counts.asked++;
		if (applied.status === 'paid') counts.paid++;
		if (applied.status === 'failed') counts.failed++;
	}
	return counts;
}

/** Stops waiting for a payment at the desk, audited. A link paid afterwards is still recorded. */
export async function cancelOnlinePayment(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	id: number
): Promise<void> {
	const [row] = await tx
		.select({ status: onlinePayment.status })
		.from(onlinePayment)
		.where(
			and(
				eq(onlinePayment.id, id),
				eq(onlinePayment.patientId, patientId),
				notDeleted(onlinePayment)
			)
		)
		.limit(1)
		.for('update');
	refuseUnless(Boolean(row), 'That online payment is not on this patient’s record.');
	refuseUnless(row.status === 'pending', 'Only a payment still waiting can be given up on.');
	await tx
		.update(onlinePayment)
		.set({ status: 'cancelled', updatedBy: event.locals.user?.id })
		.where(eq(onlinePayment.id, id));
	await recordAudit(tx, event, {
		table: 'online_payment',
		recordId: id,
		action: 'update',
		before: { status: 'pending' },
		after: { status: 'cancelled' }
	});
}

/** A patient's online payments: every one still waiting, and the rest from the last sixty days. */
export async function patientOnlinePayments(patientId: number, reader: Reader = db) {
	const since = new Date(Date.now() - 60 * GIVE_UP_AFTER_MS);
	return reader
		.select({
			id: onlinePayment.id,
			provider: onlinePayment.provider,
			// Attribution: a removed account still took the payment.
			account: paymentGateway.label,
			mode: paymentGateway.mode,
			reference: onlinePayment.reference,
			amount: onlinePayment.amount,
			allocations: onlinePayment.allocations,
			status: onlinePayment.status,
			checkoutUrl: onlinePayment.checkoutUrl,
			error: onlinePayment.error,
			createdAt: onlinePayment.createdAt,
			paidAt: onlinePayment.paidAt,
			receiptNumber: transactions.receiptNumber,
			transactionId: onlinePayment.transactionId
		})
		.from(onlinePayment)
		.innerJoin(paymentGateway, eq(paymentGateway.id, onlinePayment.gatewayId))
		.leftJoin(transactions, eq(transactions.id, onlinePayment.transactionId))
		.where(
			and(
				eq(onlinePayment.patientId, patientId),
				notDeleted(onlinePayment),
				or(eq(onlinePayment.status, 'pending'), gte(onlinePayment.createdAt, since))
			)
		)
		.orderBy(desc(onlinePayment.id));
}

/**
 * Texts the patient the link to a payment still waiting. Through the SMS gateway, logged as a
 * `payment` message, and never to a patient who asked not to be texted.
 */
export async function textPaymentLink(
	event: AuditRequest & { locals: { branch: { active: number | null } } },
	patientId: number,
	id: number
): Promise<SmsOutcome | { status: 'refused'; reason: string }> {
	const [row] = await db
		.select({
			status: onlinePayment.status,
			amount: onlinePayment.amount,
			checkoutUrl: onlinePayment.checkoutUrl,
			phone: onlinePayment.phone,
			name: patient.name,
			patientPhone: patient.phone,
			optedOut: patient.smsOptOut
		})
		.from(onlinePayment)
		.innerJoin(patient, eq(patient.id, onlinePayment.patientId))
		.where(
			and(
				eq(onlinePayment.id, id),
				eq(onlinePayment.patientId, patientId),
				notDeleted(onlinePayment)
			)
		)
		.limit(1);
	if (!row || row.status !== 'pending' || !row.checkoutUrl) {
		return { status: 'refused', reason: 'Only a payment still waiting has a link to send.' };
	}
	return sendSms(event, {
		kind: 'payment',
		body: `ሰላም ${row.name}፣ ${formatETB(row.amount)} ለመክፈል ይህን ሊንክ ይጫኑ፦ ${row.checkoutUrl}`,
		phone: row.phone || row.patientPhone,
		patientId,
		optedOut: row.optedOut
	});
}
