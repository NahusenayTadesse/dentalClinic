import { describe, expect, it } from 'vitest';
import { and, eq, isNotNull } from 'drizzle-orm';

import { db } from './db';
import {
	branch,
	cashSession,
	clinicSettings,
	payerAuthorisation,
	customers,
	invoice,
	patient,
	paymentMethods,
	procedures,
	provider,
	services,
	transactions
} from './db/schema';
import { inRollback, type TestTx } from '$lib/testing/rollback';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { WriteRefused } from './childCrud';
import { patientBalance, payerInvoices, unbilledWork } from './billing';
import {
	addCharge,
	createInvoice,
	issueInvoice,
	setPayer,
	requestVoid,
	setDiscount,
	settleInvoiceRequests
} from './invoiceWrites';
import { paidOn, requestRefund, settleRefunds, takePayerPayment, takePayment } from './payments';
import { closeDrawer, openDrawer } from './cashDrawer';

/**
 * Money, so the refusals are the point: work billed once, a big discount past a manager before
 * anyone pays, cash only into an open drawer, never more paid than owed, a drawer count that has
 * to explain itself, and nothing voided with money on it. Built inside rollbacks; a patient, a
 * dentist, a service, a branch and the two payment methods are borrowed.
 */
describe('billing', async () => {
	const [someone] = await db.select({ id: patient.id }).from(patient).limit(1);
	const [dentist] = await db.select({ id: provider.id }).from(provider).limit(1);
	const [service] = await db
		.select({ id: services.id })
		.from(services)
		.where(and(isNotNull(services.price), eq(services.area, 'mouth')))
		.limit(1);
	const [place] = await db.select({ id: branch.id }).from(branch).limit(1);
	const [cash] = await db
		.select({ id: paymentMethods.id })
		.from(paymentMethods)
		.where(eq(paymentMethods.kind, 'cash'))
		.limit(1);
	const [bank] = await db
		.select({ id: paymentMethods.id })
		.from(paymentMethods)
		.where(eq(paymentMethods.kind, 'bank'))
		.limit(1);
	const ready = Boolean(someone && dentist && service && place && cash && bank);

	const request = {
		locals: { user: null, branch: { active: place?.id ?? null } },
		getClientAddress: () => '127.0.0.1'
	};

	/** Completed work on the borrowed patient at these fees, and the 10% discount threshold. */
	async function doneWork(tx: TestTx, fees: number[]) {
		await tx
			.update(clinicSettings)
			.set({ discountApprovalPercent: 10 })
			.where(eq(clinicSettings.id, 1));
		const ids: number[] = [];
		for (const fee of fees) {
			const [row] = await tx
				.insert(procedures)
				.values({
					patientId: someone.id,
					serviceId: service.id,
					providerId: dentist.id,
					status: 'completed',
					completedOn: '2026-09-20',
					fee
				})
				.$returningId();
			ids.push(row.id);
		}
		return ids;
	}

	/** A bill for this work, issued. */
	async function issued(tx: TestTx, work: number[], discount = 0) {
		const id = await createInvoice(tx, request, {
			patientId: someone.id,
			procedureIds: work,
			branchId: place.id
		});
		if (discount) await setDiscount(tx, request, someone.id, id, discount);
		await issueInvoice(tx, request, someone.id, id, { dueOn: null });
		return id;
	}

	const refused = async (write: Promise<unknown>) => {
		try {
			await write;
		} catch (err) {
			if (err instanceof WriteRefused) return err.message;
			throw err;
		}
		return null;
	};

	it.skipIf(!ready)(
		'bills work once, numbers it, and keeps the price it was billed at',
		async () => {
			const result = await inRollback(async (tx) => {
				const [a] = await doneWork(tx, [1500]);
				const id = await issued(tx, [a]);
				const twice = await refused(
					createInvoice(tx, request, {
						patientId: someone.id,
						procedureIds: [a],
						branchId: place.id
					})
				);
				// Re-pricing the procedure afterwards does not touch the bill.
				await tx.update(procedures).set({ fee: 9999 }).where(eq(procedures.id, a));
				const [bill] = await tx.select().from(invoice).where(eq(invoice.id, id));
				const stillUnbilled = (await unbilledWork(someone.id, tx)).map((w) => w.id);
				return { bill, twice, stillUnbilled, a };
			});
			expect(result.bill.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
			expect(result.bill.total).toBe(1500);
			expect(result.bill.approvalStatus).toBe('approved');
			expect(result.twice).toMatch(/already billed/);
			expect(result.stillUnbilled).not.toContain(result.a);
		}
	);

	it.skipIf(!ready)(
		'sends a big discount to a manager, takes no payment meanwhile, and restores the price if refused',
		async () => {
			const result = await inRollback(async (tx) => {
				const [a] = await doneWork(tx, [2000]);
				const id = await issued(tx, [a], 500); // 25%, over the 10% threshold
				const [waiting] = await tx.select().from(invoice).where(eq(invoice.id, id));
				const payWhileWaiting = await refused(
					takePayment(tx, request, {
						patientId: someone.id,
						allocations: [{ invoiceId: id, amount: 100 }],
						paymentMethodId: bank.id,
						branchId: place.id,
						reference: null
					})
				);
				await tx.update(invoice).set({ approvalStatus: 'rejected' }).where(eq(invoice.id, id));
				await settleInvoiceRequests([id], 'rejected', tx);
				const [after] = await tx.select().from(invoice).where(eq(invoice.id, id));
				return { waiting, payWhileWaiting, after };
			});
			expect(result.waiting.approvalStatus).toBe('pending');
			expect(result.waiting.total).toBe(1500);
			expect(result.payWhileWaiting).toMatch(/waiting for a manager/);
			expect(result.after.approvalStatus).toBe('approved');
			expect(result.after.discount).toBeNull();
			expect(result.after.total).toBe(2000);
		}
	);

	it.skipIf(!ready)(
		'takes cash only into an open drawer, splits one payment over two bills, and counts the drawer',
		async () => {
			const result = await inRollback(async (tx) => {
				const [a, b] = await doneWork(tx, [1000, 3000]);
				const first = await issued(tx, [a]);
				const second = await issued(tx, [b]);
				const pay = (amounts: [number, number], method: number) =>
					takePayment(tx, request, {
						patientId: someone.id,
						allocations: [
							{ invoiceId: first, amount: amounts[0] },
							{ invoiceId: second, amount: amounts[1] }
						],
						paymentMethodId: method,
						branchId: place.id,
						reference: null
					});

				const drawerShut = await refused(pay([1000, 500], cash.id));
				// Close whatever drawer the dev data left open, so this test owns the branch's drawer.
				await tx
					.update(cashSession)
					.set({ status: 'closed' })
					.where(and(eq(cashSession.branchId, place.id), eq(cashSession.status, 'open')));
				await openDrawer(tx, request, place.id, 200);
				const tooMuch = await refused(pay([1000, 3500], cash.id));
				await pay([1000, 500], cash.id);

				const bills = await tx
					.select({ id: invoice.id, status: invoice.status })
					.from(invoice)
					.where(eq(invoice.patientId, someone.id));
				const owed = await patientBalance(someone.id, tx);

				const unexplained = await refused(
					closeDrawer(tx, request, place.id, { counted: 1650, banked: 1500, note: null })
				);
				const variance = await closeDrawer(tx, request, place.id, {
					counted: 1700,
					banked: 1500,
					note: null
				});
				return { drawerShut, tooMuch, bills, owed, unexplained, variance, first, second };
			});
			expect(result.drawerShut).toMatch(/drawer is not open/);
			expect(result.tooMuch).toMatch(/more than bill/);
			const status = (id: number) => result.bills.find((b) => b.id === id)?.status;
			expect(status(result.first)).toBe('paid');
			expect(status(result.second)).toBe('partly');
			// 200 float + 1,500 cash taken: a count of 1,650 is 50 short and must say why.
			expect(result.unexplained).toMatch(/short by 50/);
			expect(result.variance).toBe(0);
			expect(result.owed).toBeGreaterThanOrEqual(2500);
		}
	);

	it.skipIf(!ready)('voids only an unpaid bill, and only when a manager agrees', async () => {
		const result = await inRollback(async (tx) => {
			const [a, b] = await doneWork(tx, [800, 900]);
			const unpaid = await issued(tx, [a]);
			const paid = await issued(tx, [b]);
			await takePayment(tx, request, {
				patientId: someone.id,
				allocations: [{ invoiceId: paid, amount: 100 }],
				paymentMethodId: bank.id,
				branchId: place.id,
				reference: null
			});
			const withMoney = await refused(requestVoid(tx, request, someone.id, paid, 'Mistake'));
			await requestVoid(tx, request, someone.id, unpaid, 'Billed the wrong patient');
			const [asked] = await tx.select().from(invoice).where(eq(invoice.id, unpaid));
			await settleInvoiceRequests([unpaid], 'approved', tx);
			const [voided] = await tx.select().from(invoice).where(eq(invoice.id, unpaid));
			const billableAgain = (await unbilledWork(someone.id, tx)).map((w) => w.id);
			return { withMoney, asked, voided, billableAgain, a };
		});
		expect(result.withMoney).toMatch(/Refund it first/);
		expect(result.asked.approvalStatus).toBe('pending');
		expect(result.voided.status).toBe('void');
		expect(result.billableAgain).toContain(result.a);
	});

	it.skipIf(!ready)(
		'refunds only once a manager approves, gives the bill back its balance, and not twice',
		async () => {
			const result = await inRollback(async (tx) => {
				const [a] = await doneWork(tx, [1200]);
				const id = await issued(tx, [a]);
				const paymentId = await takePayment(tx, request, {
					patientId: someone.id,
					allocations: [{ invoiceId: id, amount: 1200 }],
					paymentMethodId: bank.id,
					branchId: place.id,
					reference: null
				});
				const refundId = await requestRefund(tx, request, {
					patientId: someone.id,
					invoiceId: id,
					paymentId,
					amount: 500,
					paymentMethodId: bank.id,
					reason: 'Crown not fitted',
					branchId: place.id
				});
				const paidWhileWaiting = await paidOn(tx, id);
				const tooMuch = await refused(
					requestRefund(tx, request, {
						patientId: someone.id,
						invoiceId: id,
						paymentId,
						amount: 800, // 500 already asked for, of 1,200
						paymentMethodId: bank.id,
						reason: 'Again',
						branchId: place.id
					})
				);
				await tx
					.update(transactions)
					.set({ approvalStatus: 'approved' })
					.where(eq(transactions.id, refundId));
				await settleRefunds([refundId], 'approved', tx);
				const [bill] = await tx.select().from(invoice).where(eq(invoice.id, id));
				const [refund] = await tx.select().from(transactions).where(eq(transactions.id, refundId));
				const [original] = await tx
					.select()
					.from(transactions)
					.where(eq(transactions.id, paymentId));
				return {
					paidWhileWaiting,
					tooMuch,
					bill,
					paidAfter: await paidOn(tx, id),
					refund,
					original
				};
			});
			expect(result.paidWhileWaiting).toBe(1200);
			expect(result.tooMuch).toMatch(/At most 700/);
			expect(result.paidAfter).toBe(700);
			expect(result.bill.status).toBe('partly');
			expect(result.refund.receiptNumber).toMatch(/^RFD-/);
			expect(result.original.paymentStatus).toBe('partially_refunded');
		}
	);

	it.skipIf(!ready)('will not approve a cash refund with the drawer shut', async () => {
		const message = await inRollback(async (tx) => {
			const [a] = await doneWork(tx, [600]);
			const id = await issued(tx, [a]);
			const paymentId = await takePayment(tx, request, {
				patientId: someone.id,
				allocations: [{ invoiceId: id, amount: 600 }],
				paymentMethodId: bank.id,
				branchId: place.id,
				reference: null
			});
			await tx
				.update(cashSession)
				.set({ status: 'closed' })
				.where(and(eq(cashSession.branchId, place.id), eq(cashSession.status, 'open')));
			const refundId = await requestRefund(tx, request, {
				patientId: someone.id,
				invoiceId: id,
				paymentId,
				amount: 600,
				paymentMethodId: cash.id,
				reason: 'Paid twice',
				branchId: place.id
			});
			await tx
				.update(transactions)
				.set({ approvalStatus: 'approved' })
				.where(eq(transactions.id, refundId));
			return refused(settleRefunds([refundId], 'approved', tx));
		});
		expect(message).toMatch(/open the cash drawer/);
	});

	it.skipIf(!ready)(
		'divides a payer’s bill: co-payment, yearly limit, pre-authorisation, and a discount awaiting a manager',
		async () => {
			const result = await inRollback(async (tx) => {
				await tx
					.update(clinicSettings)
					.set({ vatRegistered: false, discountApprovalPercent: 10 })
					.where(eq(clinicSettings.id, 1));
				const payer = (terms: Partial<typeof customers.$inferInsert>, tin: string) =>
					insertReturningId(tx, customers, {
						name: `Cover test ${tin}`,
						phone: '0911000000',
						tinNo: tin,
						approvalStatus: 'approved',
						...terms
					});
				/** One bill of `fee` to `customerId`, issued, with an optional discount. */
				const billTo = async (customerId: number, fee: number, discount = 0) => {
					const [work] = await doneWork(tx, [fee]);
					const id = await createInvoice(tx, request, {
						patientId: someone.id,
						procedureIds: [work],
						branchId: place.id
					});
					await setPayer(tx, request, someone.id, id, customerId);
					if (discount) await setDiscount(tx, request, someone.id, id, discount);
					await issueInvoice(tx, request, someone.id, id, { dueOn: null });
					return id;
				};
				const read = async (id: number) =>
					(await tx.select().from(invoice).where(eq(invoice.id, id)))[0];
				const coPayOf = async (id: number) =>
					(await tx.select().from(invoice).where(eq(invoice.coPayOfInvoiceId, id)))[0] ?? null;

				// An insurer paying 80%.
				const insurer = await payer({ coveragePercent: 80 }, 'COVER-80');
				const shared = await billTo(insurer, 1000);

				// A yearly limit of 1,000: the second 800 bill gets only the 200 left.
				const capped = await payer({ annualLimit: 1000 }, 'COVER-LIMIT');
				await billTo(capped, 800);
				const overLimit = await billTo(capped, 800);

				// Pre-authorisation required: refused without one, capped by one.
				const strict = await payer({ requiresPreauth: true }, 'COVER-AUTH');
				const refusedWithout = await refused(billTo(strict, 1000));
				await tx.insert(payerAuthorisation).values({
					patientId: someone.id,
					customerId: strict,
					reference: 'PA-1',
					approvedAmount: 600,
					status: 'approved'
				});
				const authorised = await billTo(strict, 1000);

				// A discount over the limit waits for a manager, and the bill is divided only then.
				const waiting = await billTo(insurer, 1000, 300);
				const beforeDecision = await read(waiting);
				// As the approvals queue does: the row is approved first, then the hook runs.
				await tx.update(invoice).set({ approvalStatus: 'approved' }).where(eq(invoice.id, waiting));
				await settleInvoiceRequests([waiting], 'approved', tx);

				return {
					shared: await read(shared),
					sharedCoPay: await coPayOf(shared),
					overLimit: await read(overLimit),
					overLimitCoPay: await coPayOf(overLimit),
					refusedWithout,
					authorised: await read(authorised),
					authorisedCoPay: await coPayOf(authorised),
					beforeDecision,
					afterDecision: await read(waiting),
					waitingCoPay: await coPayOf(waiting)
				};
			});

			expect(result.shared.total).toBe(800);
			expect(result.shared.coPayment).toBe(200);
			expect(result.sharedCoPay).toMatchObject({ total: 200, status: 'issued', customerId: null });
			expect(result.sharedCoPay?.invoiceNumber).toBeTruthy();

			expect(result.overLimit.total).toBe(200);
			expect(result.overLimitCoPay?.total).toBe(600);

			expect(result.refusedWithout).toMatch(/pre-authorisation/);
			expect(result.authorised.total).toBe(600);
			expect(result.authorised.authorisationId).not.toBeNull();
			expect(result.authorisedCoPay?.total).toBe(400);

			expect(result.beforeDecision.coPayment).toBeNull();
			// 1,000 less 300 is 700; the insurer pays 80% of it.
			expect(result.afterDecision.total).toBe(560);
			expect(result.waitingCoPay?.total).toBe(140);
		}
	);

	it.skipIf(!ready)(
		'charges VAT on goods only, after the discount, and keeps it when a discount is refused',
		async () => {
			const result = await inRollback(async (tx) => {
				// A VAT-registered clinic at 15% that does not tax treatment, and a 1% discount limit
				// so the discount below goes to a manager.
				await tx
					.update(clinicSettings)
					.set({
						vatRegistered: true,
						vatRate: 15,
						vatOnServices: false,
						discountApprovalPercent: 1
					})
					.where(eq(clinicSettings.id, 1));
				const [filling] = await doneWork(tx, [1800]);
				const id = await createInvoice(tx, request, {
					patientId: someone.id,
					procedureIds: [filling],
					branchId: place.id
				});
				await addCharge(tx, request, someone.id, id, {
					description: 'Toothbrush',
					quantity: 2,
					unitPrice: 100,
					taxable: true
				});
				await setDiscount(tx, request, someone.id, id, 200);
				await issueInvoice(tx, request, someone.id, id, { dueOn: null });
				const [issued] = await tx.select().from(invoice).where(eq(invoice.id, id));
				// The manager refuses the discount: full price again, VAT recomputed at 15%.
				await settleInvoiceRequests([id], 'rejected', tx);
				const [refused] = await tx.select().from(invoice).where(eq(invoice.id, id));
				return { issued, refused };
			});
			// 2,000 of lines, 200 of them taxable; 10% off spreads to 180 taxable; 15% of 180 is 27.
			expect(result.issued.subtotal).toBe(2000);
			expect(result.issued.vatRate).toBe(15);
			expect(result.issued.vatAmount).toBe(27);
			expect(result.issued.total).toBe(1827);
			// Without the discount: 15% of 200.
			expect(result.refused.vatAmount).toBe(30);
			expect(result.refused.total).toBe(2030);
		}
	);

	it.skipIf(!ready)(
		'needs a mobile payment’s transaction ID, and never takes the same one twice',
		async () => {
			const result = await inRollback(async (tx) => {
				const mobile = await insertReturningId(tx, paymentMethods, {
					name: 'Mobile money (test)',
					kind: 'mobile'
				});
				const [a, b, c] = await doneWork(tx, [400, 600, 800]);
				const bills = [await issued(tx, [a]), await issued(tx, [b]), await issued(tx, [c])];
				const pay = (bill: number, method: number, reference: string | null) =>
					takePayment(tx, request, {
						patientId: someone.id,
						allocations: [{ invoiceId: bill, amount: 100 }],
						paymentMethodId: method,
						branchId: place.id,
						reference
					});

				const noReference = await refused(pay(bills[0], mobile, null));
				const first = await pay(bills[0], mobile, 'bx 12ab 34cd');
				// The same transfer, typed the way the statement prints it, on another bill.
				const again = await refused(pay(bills[1], mobile, 'BX12AB34CD'));
				// A bank payment may go without a reference.
				const bankWithout = await refused(pay(bills[2], bank.id, null));
				const [stored] = await tx
					.select({ token: transactions.gatewayTxnToken })
					.from(transactions)
					.where(eq(transactions.id, first));
				return { noReference, again, bankWithout, stored };
			});
			expect(result.noReference).toMatch(/transaction ID/);
			expect(result.again).toMatch(/already recorded, on receipt/);
			expect(result.bankWithout).toBeNull();
			expect(result.stored.token).toBe('BX12AB34CD');
		}
	);

	it.skipIf(!ready)('lets a payer settle bills of more than one patient at once', async () => {
		const result = await inRollback(async (tx) => {
			const [payer] = await tx
				.insert(customers)
				.values({
					name: 'Billing Test Insurer',
					phone: '0110000000',
					email: 'insurer@example.test',
					tinNo: `TEST-${Date.now()}`
				})
				.$returningId();
			// The patient's payer is taken as the bill's by default.
			await tx.update(patient).set({ customerId: payer.id }).where(eq(patient.id, someone.id));
			const [a, b] = await doneWork(tx, [1000, 400]);
			const first = await issued(tx, [a]);
			const second = await issued(tx, [b]);
			const [bill] = await tx.select().from(invoice).where(eq(invoice.id, first));

			await takePayerPayment(tx, request, {
				customerId: payer.id,
				allocations: [
					{ invoiceId: first, amount: 1000 },
					{ invoiceId: second, amount: 400 }
				],
				paymentMethodId: bank.id,
				branchId: place.id,
				reference: 'Insurer transfer'
			});
			const account = await payerInvoices(payer.id, tx);
			return { billedTo: bill.customerId, payer: payer.id, account };
		});
		expect(result.billedTo).toBe(result.payer);
		expect(result.account.map((b) => b.status).sort()).toEqual(['paid', 'paid']);
		expect(result.account.every((b) => b.owed === 0)).toBe(true);
	});
});
