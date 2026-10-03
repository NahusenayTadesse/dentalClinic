/**
 * A patient's account statement: every bill, payment, refund and deposit in a period, with the
 * balance brought forward and carried after each line. Read only — the figures are the ones the
 * billing screens already show, laid out the way a patient (or their employer) checks them.
 *
 * The balance is what the patient owes less what they have in credit: bills, less payments made on
 * them, less deposits taken. A deposit counts when it is paid, not when it is used — applying one to
 * a bill moves money inside the account, so it is not a line. The closing figure therefore equals
 * `patientBalance` less `patientCredit`, which the tests hold it to.
 *
 * Bills billed to an employer or insurer are on it too, marked so: the patient's balance counts them,
 * and a statement that left them off would not add up to the figure on the chart.
 *
 * Non-goals: an aged-debt breakdown (the receivables report has it), and statements for a payer —
 * the payer's page lists its bills.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	customers,
	invoice,
	invoicePayment,
	patientDeposit,
	transactions
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { isoDate } from '$lib/server/db/dialect';
import { clinicDate } from '$lib/clinicTime';
import { cents } from '$lib/invoiceStatus';

/** One line of the statement. `debit` adds to what is owed, `credit` takes from it. */
export type StatementLine = {
	date: string;
	reference: string;
	description: string;
	debit: number;
	credit: number;
};

/** The statement for a period: brought forward, the lines with their running balance, carried. */
export async function patientStatement(patientId: number, from: string, to: string) {
	const [bills, allocations, deposits] = await Promise.all([
		db
			.select({
				id: invoice.id,
				number: invoice.invoiceNumber,
				issuedOn: isoDate(invoice.issuedOn),
				total: invoice.total,
				payer: customers.name
			})
			.from(invoice)
			.leftJoin(customers, eq(customers.id, invoice.customerId))
			.where(
				and(
					eq(invoice.patientId, patientId),
					inArray(invoice.status, ['issued', 'partly', 'paid']),
					notDeleted(invoice)
				)
			),
		// Money on the patient's bills that did not come from a deposit: payments and refunds.
		db
			.select({
				transactionId: transactions.id,
				amount: invoicePayment.amount,
				receipt: transactions.receiptNumber,
				on: isoDate(transactions.occurredOn),
				createdAt: transactions.createdAt,
				direction: transactions.direction,
				number: invoice.invoiceNumber,
				payerPaid: transactions.customerId
			})
			.from(invoicePayment)
			.innerJoin(invoice, eq(invoice.id, invoicePayment.invoiceId))
			.innerJoin(
				transactions,
				and(
					eq(transactions.id, invoicePayment.transactionId),
					eq(transactions.approvalStatus, 'approved'),
					notDeleted(transactions)
				)
			)
			.leftJoin(patientDeposit, eq(patientDeposit.transactionId, transactions.id))
			.where(
				and(
					eq(invoice.patientId, patientId),
					notDeleted(invoicePayment),
					notDeleted(invoice),
					isNull(patientDeposit.id)
				)
			),
		db
			.select({
				amount: transactions.amount,
				receipt: transactions.receiptNumber,
				on: isoDate(transactions.occurredOn),
				createdAt: transactions.createdAt,
				note: patientDeposit.note
			})
			.from(patientDeposit)
			.innerJoin(
				transactions,
				and(
					eq(transactions.id, patientDeposit.transactionId),
					eq(transactions.approvalStatus, 'approved'),
					notDeleted(transactions)
				)
			)
			.where(and(eq(patientDeposit.patientId, patientId), notDeleted(patientDeposit)))
			.orderBy(asc(transactions.createdAt))
	]);

	// A payment spread over several bills is one line: what it put on this patient's account.
	const payments = new Map<number, StatementLine>();
	for (const a of allocations) {
		const date = a.on ?? clinicDate(a.createdAt);
		const line = payments.get(a.transactionId) ?? {
			date,
			reference: a.receipt ?? `TX-${a.transactionId}`,
			description: a.direction === 'out' ? 'Refund' : a.payerPaid ? 'Paid by the payer' : 'Payment',
			debit: 0,
			credit: 0
		};
		if (a.amount < 0) line.debit = cents(line.debit - a.amount);
		else line.credit = cents(line.credit + a.amount);
		line.description += a.number && !line.description.includes(a.number) ? ` · ${a.number}` : '';
		payments.set(a.transactionId, line);
	}

	const all: StatementLine[] = [
		...bills.map((b) => ({
			date: b.issuedOn,
			reference: b.number ?? `BILL-${b.id}`,
			description: b.payer ? `Bill — billed to ${b.payer}` : 'Bill',
			debit: b.total,
			credit: 0
		})),
		...payments.values(),
		...deposits.map((d) => ({
			date: d.on ?? clinicDate(d.createdAt),
			reference: d.receipt ?? 'Deposit',
			description: d.note ? `Deposit — ${d.note}` : 'Deposit',
			debit: 0,
			credit: d.amount
		}))
	].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : y.debit - x.debit));

	const before = all.filter((l) => l.date < from);
	const during = all.filter((l) => l.date >= from && l.date <= to);
	const opening = cents(before.reduce((s, l) => s + l.debit - l.credit, 0));
	let balance = opening;
	const lines = during.map((l) => {
		balance = cents(balance + l.debit - l.credit);
		return { ...l, balance };
	});
	return {
		opening,
		lines,
		closing: balance,
		billed: cents(during.reduce((s, l) => s + l.debit, 0)),
		paid: cents(during.reduce((s, l) => s + l.credit, 0))
	};
}
