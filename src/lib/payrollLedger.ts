/**
 * The three pay adjustments, described once for the server and the screens: overtime, bonuses and
 * deductions. Each is a dated amount against one employee that the next payroll run picks up
 * (`server/payrollRun.ts`), so they share one route, one table and one set of rules
 * (`server/payrollLedger.ts`) — they used to be two hand-copied month pages, the second still
 * calling its rows `overtimeDetails`, and bonuses had no list at all.
 *
 * Client-safe: no database here, only what each kind is called and which fields it asks for.
 */

export const LEDGER_KINDS = ['overtime', 'bonuses', 'deductions'] as const;

export type LedgerKind = (typeof LEDGER_KINDS)[number];

export type LedgerMeta = {
	title: string;
	singular: string;
	/** One line under the heading. */
	blurb: string;
	/** Overtime is hours at a type's rate; the others are an amount typed in. */
	priced: 'hours' | 'amount';
	/** What the type facet and field are called; null when the kind has none. */
	typeLabel: string | null;
	/** Whether the amount adds to pay or takes from it. */
	effect: 'adds' | 'takes';
};

export const LEDGER: Record<LedgerKind, LedgerMeta> = {
	overtime: {
		title: 'Overtime',
		singular: 'overtime',
		blurb: 'Hours worked beyond the schedule, paid at each overtime type’s rate.',
		priced: 'hours',
		typeLabel: 'Overtime type',
		effect: 'adds'
	},
	bonuses: {
		title: 'Bonuses',
		singular: 'bonus',
		blurb: 'One-off amounts added to an employee’s pay.',
		priced: 'amount',
		typeLabel: null,
		effect: 'adds'
	},
	deductions: {
		title: 'Deductions',
		singular: 'deduction',
		blurb: 'Amounts taken from an employee’s pay — penalties, advances repaid, damage.',
		priced: 'amount',
		typeLabel: 'Kind of deduction',
		effect: 'takes'
	}
};

export function isLedgerKind(value: unknown): value is LedgerKind {
	return typeof value === 'string' && (LEDGER_KINDS as readonly string[]).includes(value);
}

/** Where each kind's list lives. */
export function ledgerHref(kind: LedgerKind): string {
	return `/dashboard/salary/ledger/${kind}`;
}
