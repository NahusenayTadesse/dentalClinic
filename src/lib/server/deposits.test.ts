import { describe, expect, it } from 'vitest';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from './db';
import { invoice, patient, paymentMethods, user } from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { WriteRefused } from './childCrud';
import { createInvoice, issueInvoice } from './invoiceWrites';
import { patientBalance } from './billing';
import { applyCredit, patientCredit, takeDeposit } from './deposits';
import { patientStatement } from './statements';
import { clinicToday } from '$lib/clinicTime';

/**
 * A deposit is credit until it is applied; applying it pays a bill like any payment; and the
 * statement's closing figure is always the balance less the credit. Built inside rollbacks; a
 * patient billed to nobody, a non-cash payment method and a user are borrowed.
 */
describe('deposits and statements', async () => {
	const [someone] = await db
		.select({ id: patient.id })
		.from(patient)
		.where(and(isNull(patient.customerId), isNull(patient.deletedAt)))
		.limit(1);
	const [method] = await db
		.select({ id: paymentMethods.id })
		.from(paymentMethods)
		.where(inArray(paymentMethods.kind, ['bank', 'card', 'other']))
		.limit(1);
	const [clerk] = await db.select({ id: user.id }).from(user).limit(1);
	const ready = Boolean(someone && method && clerk);

	const event = {
		locals: { user: clerk ? { id: clerk.id } : null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};

	it.skipIf(!ready)(
		'applies credit to a bill and keeps the statement equal to balance less credit',
		async () => {
			const result = await inRollback(async (tx) => {
				const startBalance = await patientBalance(someone.id, tx);
				const startCredit = await patientCredit(someone.id, tx);

				await takeDeposit(tx, event, {
					patientId: someone.id,
					amount: 2000,
					paymentMethodId: method.id,
					branchId: null,
					reference: null,
					note: 'Crown on 36'
				});
				const billId = await createInvoice(tx, event, {
					patientId: someone.id,
					procedureIds: [],
					branchId: null,
					charges: [{ description: 'Crown', quantity: 1, unitPrice: 3500 }]
				});
				await issueInvoice(tx, event, someone.id, billId, { dueOn: null });
				const creditBefore = await patientCredit(someone.id, tx);
				const applied = await applyCredit(tx, event, someone.id, billId);
				const [bill] = await tx
					.select({ status: invoice.status })
					.from(invoice)
					.where(eq(invoice.id, billId));
				let again: string | null = null;
				try {
					await applyCredit(tx, event, someone.id, billId);
				} catch (err) {
					if (err instanceof WriteRefused) again = err.message;
					else throw err;
				}
				const balance = await patientBalance(someone.id, tx);
				const credit = await patientCredit(someone.id, tx);
				return {
					startBalance,
					startCredit,
					creditBefore,
					applied,
					status: bill.status,
					again,
					balance,
					credit
				};
			});

			expect(result.creditBefore).toBe(result.startCredit + 2000);
			expect(result.applied).toBe(Math.min(3500, result.creditBefore));
			expect(result.status).toBe(result.applied >= 3500 ? 'paid' : 'partly');
			expect(result.again).toMatch(/no credit left|paid/);
			expect(result.balance).toBe(result.startBalance + 3500 - result.applied);
			expect(result.credit).toBe(result.creditBefore - result.applied);
		}
	);

	it.skipIf(!ready)('closes the statement on the balance less the credit', async () => {
		const statement = await patientStatement(someone.id, '2000-01-01', clinicToday());
		const balance = await patientBalance(someone.id);
		const credit = await patientCredit(someone.id);
		expect(statement.closing).toBe(Math.round((balance - credit) * 100) / 100);
	});
});
