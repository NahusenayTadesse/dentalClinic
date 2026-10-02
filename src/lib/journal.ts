/**
 * Turning the clinic's money into journal entries for an accountant's ledger — Peachtree (Sage 50)
 * above all, which is what most accountants here keep, or any ledger that imports a plain journal.
 * Client-safe and pure; `server/accountingExport.ts` reads the transactions and the accounts.
 *
 * **Cash basis.** Every entry is a `transactions` row — money that actually moved, in or out of
 * a till, a bank account or a mobile wallet. That is how a clinic here keeps its books and how its
 * accountant expects them; bills not yet paid stay in the clinic's own receivables report.
 *
 * Each kind of movement makes the same two- or three-line entry every time:
 *
 *   payment for bills   Dr the payment method's account · Cr revenue (net) · Cr VAT payable
 *   refund              the same, reversed
 *   expense             Dr the expense type's account   · Cr the payment method's account
 *   stock bought        Dr inventory                    · Cr the payment method's account
 *   salaries            Dr salaries                     · Cr the payment method's account
 *   anything else       Dr or Cr suspense, for the accountant to place
 *
 * An account the clinic has not given a code is exported under `UNMAPPED` and listed on screen, so
 * an import never silently posts to the wrong place.
 */

/** The accounts every clinic needs a code for, beyond its payment methods and expense types. */
export const FIXED_ACCOUNTS = {
	revenue: 'Patient fees (revenue)',
	vatPayable: 'VAT payable',
	inventory: 'Stock (inventory)',
	salaries: 'Salaries and wages',
	suspense: 'Suspense — to be placed'
} as const;
export type FixedAccount = keyof typeof FIXED_ACCOUNTS;

/** What a transaction was, as far as the books are concerned. */
export type MoneyKind = 'billPayment' | 'refund' | 'expense' | 'stock' | 'salaries' | 'other';

/** The code put on a line whose account the clinic has not mapped. */
export const UNMAPPED = 'UNMAPPED';

/** One line of an entry. Debit and credit are positive; one of them is zero. */
export type JournalLine = { account: string; debit: number; credit: number };

/** One entry: a transaction's lines, which balance. */
export type JournalEntry = {
	date: string;
	reference: string;
	description: string;
	lines: JournalLine[];
};

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * The lines of one movement. `amount` is what moved, positive; `vat` the VAT inside a bill payment
 * or refund; `money` the payment method's account and `other` the account on the far side — the
 * expense type's, for an expense.
 */
export function entryLines(input: {
	kind: MoneyKind;
	direction: 'in' | 'out';
	amount: number;
	vat: number;
	money: string;
	other: string | null;
	fixed: Record<FixedAccount, string>;
}): JournalLine[] {
	const amount = cents(Math.abs(input.amount));
	const vat = cents(Math.min(Math.max(input.vat, 0), amount));
	const debit = (account: string, n: number): JournalLine => ({ account, debit: n, credit: 0 });
	const credit = (account: string, n: number): JournalLine => ({ account, debit: 0, credit: n });
	const sales = (sign: 'in' | 'out') => {
		const lines =
			sign === 'in'
				? [debit(input.money, amount), credit(input.fixed.revenue, cents(amount - vat))]
				: [debit(input.fixed.revenue, cents(amount - vat)), credit(input.money, amount)];
		if (vat > 0)
			lines.push(
				sign === 'in' ? credit(input.fixed.vatPayable, vat) : debit(input.fixed.vatPayable, vat)
			);
		return lines;
	};

	switch (input.kind) {
		case 'billPayment':
			return sales('in');
		case 'refund':
			return sales('out');
		case 'expense':
			return [debit(input.other ?? UNMAPPED, amount), credit(input.money, amount)];
		case 'stock':
			return [debit(input.fixed.inventory, amount), credit(input.money, amount)];
		case 'salaries':
			return [debit(input.fixed.salaries, amount), credit(input.money, amount)];
		default:
			return input.direction === 'in'
				? [debit(input.money, amount), credit(input.fixed.suspense, amount)]
				: [debit(input.fixed.suspense, amount), credit(input.money, amount)];
	}
}

/** Whether an entry's debits equal its credits, to the cent. */
export function balances(lines: JournalLine[]): boolean {
	const d = lines.reduce((s, l) => s + l.debit, 0);
	const c = lines.reduce((s, l) => s + l.credit, 0);
	return Math.round(d * 100) === Math.round(c * 100);
}

/** A field for a CSV: quoted when it must be, quotes doubled. */
function field(value: string | number): string {
	const text = String(value);
	return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const row = (values: (string | number)[]) => values.map(field).join(',');

/**
 * Peachtree (Sage 50) General Journal import: one row a line, the entry's line count on each, the
 * date as MM/DD/YY, and the amount signed — debit positive, credit negative.
 */
export function peachtreeCsv(entries: JournalEntry[]): string {
	const out = [
		row(['Date', 'Reference', 'Number of Distributions', 'G/L Account', 'Description', 'Amount'])
	];
	for (const e of entries) {
		const [y, m, d] = e.date.split('-');
		const date = `${m}/${d}/${y.slice(2)}`;
		for (const line of e.lines) {
			out.push(
				row([
					date,
					e.reference,
					e.lines.length,
					line.account,
					e.description,
					(line.debit - line.credit).toFixed(2)
				])
			);
		}
	}
	return out.join('\r\n') + '\r\n';
}

/** A plain journal any ledger imports: date, reference, account, description, debit, credit. */
export function journalCsv(entries: JournalEntry[]): string {
	const out = [row(['Date', 'Reference', 'Account', 'Description', 'Debit', 'Credit'])];
	for (const e of entries) {
		for (const line of e.lines) {
			out.push(
				row([
					e.date,
					e.reference,
					line.account,
					e.description,
					line.debit ? line.debit.toFixed(2) : '',
					line.credit ? line.credit.toFixed(2) : ''
				])
			);
		}
	}
	return out.join('\r\n') + '\r\n';
}
