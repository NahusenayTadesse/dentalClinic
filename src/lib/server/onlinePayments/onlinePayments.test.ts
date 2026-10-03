import { describe, expect, it } from 'vitest';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '../db';
import {
	invoice,
	onlinePayment,
	patient,
	paymentGateway,
	paymentMethods,
	transactions,
	user
} from '../db/schema';
import { inRollback, type TestTx } from '$lib/testing/rollback';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { createInvoice, issueInvoice } from '../invoiceWrites';
import { paidOn, takePayment } from '../payments';
import { patientCredit } from '../deposits';
import { decryptSecret } from '../secrets';
import { saveGateway } from './accounts';
import { applyAnswer, newReference } from './flow';
import type { VerifyResult } from '../payGateways/types';

/**
 * An online payment becomes money only on a paid answer for the amount asked, and only once; what
 * the bills no longer owe becomes credit; and a gateway's keys are stored so only their hint shows.
 * Built inside rollbacks; a patient billed to nobody and a user are borrowed.
 */
describe('online payments', async () => {
	const [someone] = await db
		.select({ id: patient.id })
		.from(patient)
		.where(and(isNull(patient.customerId), isNull(patient.deletedAt)))
		// The newest such patient, not the first: the billing and deposit tests borrow the first,
		// and two rollbacks billing one patient at once wait on each other's locks.
		.orderBy(desc(patient.id))
		.limit(1);
	const [clerk] = await db.select({ id: user.id }).from(user).limit(1);
	const ready = Boolean(someone && clerk);

	const event = {
		locals: { user: clerk ? { id: clerk.id } : null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};

	const paid = (amount: number): Extract<VerifyResult, { ok: true }> => ({
		ok: true,
		state: 'paid',
		amount,
		currency: 'ETB',
		providerReference: 'GW-1',
		providerStatus: 'success'
	});

	/** A Chapa account, an issued bill of `total`, and an online payment of `asked` toward it. */
	async function setUp(tx: TestTx, total: number, asked: number) {
		const gatewayId = await saveGateway(tx, event, {
			provider: 'chapa',
			label: 'Test Chapa',
			mode: 'test',
			enabled: true,
			fields: { secretKey: 'CHASECK_TEST-abcd9876' }
		});
		const [account] = await tx
			.select()
			.from(paymentGateway)
			.where(eq(paymentGateway.id, gatewayId));
		const billId = await createInvoice(tx, event, {
			patientId: someone.id,
			procedureIds: [],
			branchId: null,
			charges: [{ description: 'Crown', quantity: 1, unitPrice: total }]
		});
		await issueInvoice(tx, event, someone.id, billId, { dueOn: null });
		const reference = newReference();
		const id = await insertReturningId(tx, onlinePayment, {
			gatewayId,
			provider: 'chapa',
			reference,
			patientId: someone.id,
			amount: asked,
			allocations: [{ invoiceId: billId, amount: asked }]
		});
		return { account, billId, reference, id };
	}

	it.skipIf(!ready)('stores the key encrypted, shows a hint, and keeps it on an edit', async () => {
		const result = await inRollback(async (tx) => {
			const { account } = await setUp(tx, 100, 100);
			await saveGateway(tx, event, {
				id: account.id,
				provider: 'chapa',
				label: 'Renamed',
				mode: 'live',
				enabled: false,
				fields: { secretKey: '' }
			});
			const [after] = await tx
				.select()
				.from(paymentGateway)
				.where(eq(paymentGateway.id, account.id));
			const [method] = await tx
				.select({ name: paymentMethods.name, kind: paymentMethods.kind })
				.from(paymentMethods)
				.where(eq(paymentMethods.id, after.paymentMethodId));
			return { before: account, after, method };
		});
		expect(result.before.secretsEncrypted).not.toContain('CHASECK');
		expect(result.before.secretHint).toBe('••••9876');
		expect(JSON.parse(decryptSecret(result.after.secretsEncrypted))).toEqual({
			secretKey: 'CHASECK_TEST-abcd9876'
		});
		expect(result.after).toMatchObject({ label: 'Renamed', mode: 'live', enabled: false });
		expect(result.method).toEqual({ name: 'Chapa (online)', kind: 'other' });
	});

	it.skipIf(!ready)('records a paid answer once, however often it comes', async () => {
		const result = await inRollback(async (tx) => {
			const { account, billId, reference, id } = await setUp(tx, 1200, 1200);
			const answer = { id, result: paid(1200), paymentMethodId: account.paymentMethodId };
			const first = await applyAnswer(tx, event, answer, someone.id);
			const second = await applyAnswer(tx, event, answer, someone.id);
			const payments = await tx
				.select({ id: transactions.id, receipt: transactions.receiptNumber })
				.from(transactions)
				.where(eq(transactions.gatewayTxnToken, reference));
			const [bill] = await tx
				.select({ status: invoice.status })
				.from(invoice)
				.where(eq(invoice.id, billId));
			const [row] = await tx.select().from(onlinePayment).where(eq(onlinePayment.id, id));
			return { first, second, payments, bill, row };
		});
		expect(result.first.status).toBe('paid');
		expect(result.second.status).toBe('paid');
		expect(result.payments).toHaveLength(1);
		expect(result.payments[0].receipt).toBeTruthy();
		expect(result.bill.status).toBe('paid');
		expect(result.row).toMatchObject({
			status: 'paid',
			transactionId: result.payments[0].id,
			providerReference: 'GW-1'
		});
	});

	it.skipIf(!ready)('puts what the bill no longer owes on credit', async () => {
		const result = await inRollback(async (tx) => {
			const { account, billId, id } = await setUp(tx, 1000, 1000);
			const creditBefore = await patientCredit(someone.id, tx);
			// The desk took 400 by card while the link was out.
			await takePayment(tx, event, {
				patientId: someone.id,
				allocations: [{ invoiceId: billId, amount: 400 }],
				paymentMethodId: account.paymentMethodId,
				branchId: null,
				reference: null
			});
			const applied = await applyAnswer(
				tx,
				event,
				{ id, result: paid(1000), paymentMethodId: account.paymentMethodId },
				someone.id
			);
			return {
				applied,
				paidOnBill: await paidOn(tx, billId),
				credit: (await patientCredit(someone.id, tx)) - creditBefore
			};
		});
		expect(result.applied.status).toBe('paid');
		expect(result.paidOnBill).toBe(1000);
		expect(result.credit).toBe(400);
	});

	it.skipIf(!ready)(
		'records nothing for the wrong amount, or for an answer of not yet',
		async () => {
			const result = await inRollback(async (tx) => {
				const { account, reference, id } = await setUp(tx, 800, 800);
				const pending = await applyAnswer(
					tx,
					event,
					{
						id,
						result: { ...paid(800), state: 'pending' },
						paymentMethodId: account.paymentMethodId
					},
					someone.id
				);
				const short = await applyAnswer(
					tx,
					event,
					{ id, result: paid(500), paymentMethodId: account.paymentMethodId },
					someone.id
				);
				const payments = await tx
					.select({ id: transactions.id })
					.from(transactions)
					.where(eq(transactions.gatewayTxnToken, reference));
				return { pending, short, payments };
			});
			expect(result.pending.status).toBe('pending');
			expect(result.short.status).toBe('failed');
			expect(result.short.text).toMatch(/500/);
			expect(result.payments).toHaveLength(0);
		}
	);
});
