/**
 * The accounting export: the clinic's account codes, and a month of its money as journal entries
 * for the accountant's ledger. The entry rules and the file formats are `$lib/journal.ts`'s.
 *
 * Every entry is one `transactions` row, classified by what points at it — a bill payment's
 * `invoice_payment` rows, an expense, a stock delivery, a payroll payment — and nothing else. A
 * row nothing points at goes to suspense, which the screen counts, rather than being guessed from
 * its description.
 *
 * A row's day is `occurredOn` when the write recorded one, else the clinic day it was created —
 * worked out here rather than in SQL, which spells "the date of a timestamp in a time zone"
 * differently on every engine (CLAUDE.md §10).
 *
 * Non-goals: accrual entries (bills issued, not yet paid — the clinic's receivables report has
 * them), payroll's own split into gross, tax and pension (the payroll reports carry that; the
 * export posts what left the bank), and sending the file anywhere.
 */
import { and, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	expenses,
	expensesType,
	invoice,
	invoicePayment,
	ledgerAccount,
	patient,
	paymentMethods,
	payrollAdjustments,
	payrollReceipts,
	suppliesAdjustments,
	transactions
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { isoDate } from '$lib/server/db/dialect';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { patientFullName } from '$lib/server/patients';
import { addClinicDays, clinicDate, clinicDayRange } from '$lib/clinicTime';
import {
	FIXED_ACCOUNTS,
	UNMAPPED,
	balances,
	entryLines,
	type FixedAccount,
	type JournalEntry,
	type MoneyKind
} from '$lib/journal';
import type { MonthPeriod } from '$lib/ethiopianMonth';

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Something that needs an account code, and the code it has. */
export type AccountTarget = { target: string; label: string; group: string; code: string };

/** Every target the export can need a code for, with the codes set so far. */
export async function accountTargets(): Promise<AccountTarget[]> {
	const [codes, methods, types] = await Promise.all([
		db
			.select({ target: ledgerAccount.target, code: ledgerAccount.code })
			.from(ledgerAccount)
			.where(notDeleted(ledgerAccount)),
		db
			.select({ id: paymentMethods.id, name: paymentMethods.name })
			.from(paymentMethods)
			.where(notDeleted(paymentMethods)),
		db
			.select({ id: expensesType.id, name: expensesType.name })
			.from(expensesType)
			.where(notDeleted(expensesType))
	]);
	const code = new Map(codes.map((c) => [c.target, c.code]));
	const of = (target: string) => code.get(target) ?? '';
	return [
		...(Object.keys(FIXED_ACCOUNTS) as FixedAccount[]).map((key) => ({
			target: `fixed:${key}`,
			label: FIXED_ACCOUNTS[key],
			group: 'The clinic’s accounts',
			code: of(`fixed:${key}`)
		})),
		...methods.map((m) => ({
			target: `paymentMethod:${m.id}`,
			label: m.name,
			group: 'Where money is kept — one per payment method',
			code: of(`paymentMethod:${m.id}`)
		})),
		...types.map((t) => ({
			target: `expenseType:${t.id}`,
			label: t.name,
			group: 'Expenses — one per expense type',
			code: of(`expenseType:${t.id}`)
		}))
	];
}

/** Saves the codes typed. Only known targets are written; an empty code unmaps one. */
export async function saveAccountCodes(
	tx: Tx,
	userId: string | undefined,
	rows: { target: string; code: string }[]
): Promise<number> {
	const known = new Set((await accountTargets()).map((t) => t.target));
	const existing = new Map(
		(
			await tx
				.select({ id: ledgerAccount.id, target: ledgerAccount.target, code: ledgerAccount.code })
				.from(ledgerAccount)
		).map((r) => [r.target, r])
	);
	let changed = 0;
	for (const row of rows) {
		if (!known.has(row.target)) continue;
		const code = row.code.trim().slice(0, 30);
		const was = existing.get(row.target);
		if (was) {
			if (was.code === code) continue;
			await tx
				.update(ledgerAccount)
				.set({ code, updatedBy: userId })
				.where(eq(ledgerAccount.id, was.id));
		} else if (code) {
			await tx.insert(ledgerAccount).values({ target: row.target, code, createdBy: userId });
		} else continue;
		changed++;
	}
	return changed;
}

/** A month's money as journal entries, with what could not be placed. */
export async function journalFor(scope: Pick<BranchContext, 'active'>, period: MonthPeriod) {
	// A day either side of the month, then each row's own day decides: see the module header.
	const from = clinicDayRange(addClinicDays(period.start, -1)).start;
	const to = clinicDayRange(addClinicDays(period.end, 1)).end;
	const rows = await db
		.select({
			id: transactions.id,
			direction: transactions.direction,
			amount: transactions.amount,
			description: transactions.description,
			receiptNumber: transactions.receiptNumber,
			occurredOn: isoDate(transactions.occurredOn),
			createdAt: transactions.createdAt,
			paymentMethodId: transactions.paymentMethodId,
			patient: patientFullName
		})
		.from(transactions)
		.leftJoin(patient, eq(patient.id, transactions.patientId))
		.where(
			and(
				notDeleted(transactions),
				gte(transactions.createdAt, from),
				lt(transactions.createdAt, to),
				branchFilter(transactions.branchId, scope)
			)
		)
		.orderBy(transactions.createdAt, transactions.id);

	const dayOf = (r: (typeof rows)[number]) => r.occurredOn ?? clinicDate(r.createdAt);
	const inMonth = rows.filter((r) => {
		const day = dayOf(r);
		return day >= period.start && day <= period.end;
	});
	const ids = inMonth.map((r) => r.id);
	if (!ids.length) return { entries: [], unmapped: [], suspense: 0, unbalanced: 0 };

	const [paid, spent, stocked, paidStaff, adjusted, targets] = await Promise.all([
		db
			.select({
				transactionId: invoicePayment.transactionId,
				amount: invoicePayment.amount,
				vat: invoice.vatAmount,
				total: invoice.total
			})
			.from(invoicePayment)
			.innerJoin(invoice, eq(invoice.id, invoicePayment.invoiceId))
			.where(and(inArray(invoicePayment.transactionId, ids), notDeleted(invoicePayment))),
		db
			.select({ transactionId: expenses.transactionId, type: expenses.type })
			.from(expenses)
			.where(and(inArray(expenses.transactionId, ids), notDeleted(expenses))),
		db
			.select({ transactionId: suppliesAdjustments.transactionId })
			.from(suppliesAdjustments)
			.where(
				and(
					inArray(suppliesAdjustments.transactionId, ids),
					isNotNull(suppliesAdjustments.transactionId)
				)
			),
		db
			.select({ transactionId: payrollReceipts.transactionId })
			.from(payrollReceipts)
			.where(inArray(payrollReceipts.transactionId, ids)),
		db
			.select({ transactionId: payrollAdjustments.transactionId })
			.from(payrollAdjustments)
			.where(inArray(payrollAdjustments.transactionId, ids)),
		accountTargets()
	]);

	const code = new Map(targets.map((t) => [t.target, t.code]));
	const label = new Map(targets.map((t) => [t.target, t.label]));
	const missing = new Set<string>();
	const account = (target: string) => {
		const c = code.get(target);
		if (c) return c;
		missing.add(target);
		return UNMAPPED;
	};
	const fixed = Object.fromEntries(
		(Object.keys(FIXED_ACCOUNTS) as FixedAccount[]).map((k) => [k, account(`fixed:${k}`)])
	) as Record<FixedAccount, string>;

	const vatOf = new Map<number, number>();
	for (const p of paid) {
		if (p.transactionId === null) continue;
		const share = p.total ? (Math.abs(p.amount) * (p.vat ?? 0)) / p.total : 0;
		vatOf.set(p.transactionId, (vatOf.get(p.transactionId) ?? 0) + share);
	}
	const billIds = new Set(paid.map((p) => p.transactionId));
	const expenseType = new Map(spent.map((e) => [e.transactionId, e.type]));
	const stockIds = new Set(stocked.map((s) => s.transactionId));
	const staffIds = new Set([...paidStaff, ...adjusted].map((s) => s.transactionId));

	const kindOf = (r: (typeof inMonth)[number]): MoneyKind => {
		if (billIds.has(r.id)) return r.direction === 'in' ? 'billPayment' : 'refund';
		if (expenseType.has(r.id)) return 'expense';
		if (stockIds.has(r.id)) return 'stock';
		if (staffIds.has(r.id)) return 'salaries';
		return 'other';
	};

	let suspense = 0;
	const entries: JournalEntry[] = inMonth.map((r) => {
		const kind = kindOf(r);
		if (kind === 'other') suspense++;
		const type = expenseType.get(r.id);
		return {
			date: dayOf(r),
			reference: r.receiptNumber ?? `TX-${r.id}`,
			description: (r.description ?? (r.patient ? `Payment — ${r.patient}` : 'Transaction')).slice(
				0,
				120
			),
			lines: entryLines({
				kind,
				direction: r.direction,
				amount: r.amount,
				vat: Math.round((vatOf.get(r.id) ?? 0) * 100) / 100,
				money: r.paymentMethodId ? account(`paymentMethod:${r.paymentMethodId}`) : fixed.suspense,
				other: type ? account(`expenseType:${type}`) : null,
				fixed
			})
		};
	});

	return {
		entries,
		unmapped: [...missing].map((t) => label.get(t) ?? t),
		suspense,
		unbalanced: entries.filter((e) => !balances(e.lines)).length
	};
}
