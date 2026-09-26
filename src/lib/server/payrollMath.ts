/**
 * The arithmetic of a payslip: income tax from the bands, pension from the two rates, and net pay.
 *
 * **Why this exists.** The rules were written twice — once as SQL inside the payroll run, once in
 * JavaScript inside a payslip adjustment — and both copies were wrong in the same two ways, with a
 * third fault of their own:
 *
 *   - a band's rate is typed as a percentage (15 for 15%) and was multiplied as a fraction, so the
 *     run taxed an income of 5,000 birr at 75,000;
 *   - the top band has no upper limit, stored as a null threshold, and `income <= NULL` is never
 *     true, so the highest earners paid no tax at all;
 *   - the adjustment subtracted the *employer's* pension from the employee's net pay, and left out
 *     the absence deduction the run takes, so adjusting a payslip changed its net for no reason.
 *
 * One rule each now, in one place, tested — and the SQL form is checked against the JavaScript form
 * on real values, so the two cannot drift apart again.
 *
 * **Units.** Rates are percentages, as a clinic's accountant types them from the proclamation.
 * Thresholds and deductions are birr. A band's threshold is the top of that band; the band with no
 * threshold is everything above the rest.
 *
 * Non-goals: which figures make up gross and taxable pay, and the proration of a salary across a
 * month. Those are the run's own query; this module takes the totals it produces.
 */
import { sql, type SQL } from 'drizzle-orm';

/** One income-tax band, as stored: a percentage rate and the "quick deduction" in birr. */
export type TaxBand = { threshold: number | null; rate: number; deduction: number };

/**
 * The bands in the order they are tried: lowest threshold first, the open-ended band last.
 *
 * A clinic that entered its bands without an open-ended one still has a highest band, and income
 * above it is taxed by that band rather than not at all — the alternative is the bug this replaces.
 */
function ordered(bands: TaxBand[]): TaxBand[] {
	return [...bands].sort((a, b) => {
		if (a.threshold === null) return 1;
		if (b.threshold === null) return -1;
		return a.threshold - b.threshold;
	});
}

/** Rounds to the cent, the way a payslip is printed. */
export function toCents(amount: number): number {
	return Math.round(amount * 100) / 100;
}

/**
 * Monthly income tax on `taxable` birr: the first band whose top the income falls under, taxed at
 * that band's rate less its deduction — the "quick deduction" method the Ministry of Revenues
 * publishes the bands in. Never negative, and nothing on no income.
 */
export function incomeTax(taxable: number, bands: TaxBand[]): number {
	if (taxable <= 0 || bands.length === 0) return 0;
	const list = ordered(bands);
	const band =
		list.find((b) => b.threshold === null || taxable <= b.threshold) ?? list[list.length - 1];
	return toCents(Math.max(0, (taxable * band.rate) / 100 - band.deduction));
}

/**
 * The same rule as `incomeTax`, as a SQL expression over a taxable-income expression — for the
 * payroll run, which works out every payslip in one query.
 *
 * `payrollMath.test.ts` evaluates this against the database and compares it with `incomeTax`.
 */
export function incomeTaxSql(taxable: SQL, bands: TaxBand[]): SQL<number> {
	if (bands.length === 0) return sql<number>`0`;
	const list = ordered(bands);
	const top = list[list.length - 1];
	const cases = sql.empty();
	for (const band of list.slice(0, -1)) {
		if (band.threshold === null) continue;
		cases.append(
			sql` WHEN (${taxable}) <= ${band.threshold} THEN ((${taxable}) * ${band.rate} / 100) - ${band.deduction}`
		);
	}
	const topRule = sql`((${taxable}) * ${top.rate} / 100) - ${top.deduction}`;
	const expression = list.length > 1 ? sql`(CASE${cases} ELSE ${topRule} END)` : sql`(${topRule})`;
	// CASE rather than GREATEST for the floor at zero: SQLite has no GREATEST (CLAUDE.md §10).
	return sql<number>`CASE WHEN (${taxable}) <= 0 OR ${expression} <= 0 THEN 0 ELSE ROUND(${expression}, 2) END`;
}

/**
 * The monthly employment-income bands of Income Tax (Amendment) Proclamation No. 1395/2025,
 * in force from 7 July 2025: exempt to 2,000 birr, then 15, 20, 25, 30 and 35%.
 *
 * The bands are the proclamation's; the deductions are not a separate legal figure but the only
 * values that make "income × rate − deduction" equal the progressive tax band by band, and
 * `payrollMath.test.ts` proves that for every income. Seeded by `/setup` onto an empty table. When
 * the law changes, the clinic edits the bands in the admin panel; this list is only the start.
 */
export const CURRENT_TAX_BANDS = [
	{ name: 'Exempt (to 2,000)', threshold: 2000, rate: 0, deduction: 0 },
	{ name: '2,001 – 4,000', threshold: 4000, rate: 15, deduction: 300 },
	{ name: '4,001 – 7,000', threshold: 7000, rate: 20, deduction: 500 },
	{ name: '7,001 – 10,000', threshold: 10000, rate: 25, deduction: 850 },
	{ name: '10,001 – 14,000', threshold: 14000, rate: 30, deduction: 1350 },
	{ name: 'Above 14,000', threshold: null, rate: 35, deduction: 2050 }
] as const;

/** Pension contributions, as percentages of basic salary: the employee's share and the employer's. */
export type PensionRates = { employee: number; employer: number };

/**
 * The two pension rates from the stored rows. A share with no active row is zero — shown as a zero
 * on every payslip, which is a visible omission, rather than a guess.
 */
export function pensionRates(
	rows: { party: 'employee' | 'employer'; rate: number }[]
): PensionRates {
	return {
		employee: rows.find((r) => r.party === 'employee')?.rate ?? 0,
		employer: rows.find((r) => r.party === 'employer')?.rate ?? 0
	};
}

/**
 * The contribution rates a private employer in Ethiopia pays under the private organisation
 * employees' pension proclamation: 7% from the employee, 11% from the employer. Seeded by setup so a
 * first payroll does not run with no pension at all; the clinic edits them in the admin panel if the
 * law or its own scheme differs.
 */
export const DEFAULT_PENSION_RATES = [
	{ party: 'employee', name: 'Employee contribution', rate: 7 },
	{ party: 'employer', name: 'Employer contribution', rate: 11 }
] as const;

/** A pension contribution in birr: `rate` percent of the basic salary. */
export function pension(basicSalary: number, rate: number): number {
	return toCents((basicSalary * rate) / 100);
}

/**
 * Net pay: gross, less income tax, the absence deduction, other deductions and the **employee's**
 * pension share.
 *
 * The employer's share is not in it. It is a cost to the clinic on top of gross pay, recorded on the
 * payslip and paid to the pension fund, and never taken from what the employee receives.
 */
export function netPay(parts: {
	gross: number;
	tax: number;
	absenceDeduction: number;
	deductions: number;
	employeePension: number;
}): number {
	return toCents(
		parts.gross - parts.tax - parts.absenceDeduction - parts.deductions - parts.employeePension
	);
}
