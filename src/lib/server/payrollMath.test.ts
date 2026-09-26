import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import {
	CURRENT_TAX_BANDS,
	incomeTax,
	incomeTaxSql,
	netPay,
	pension,
	pensionRates,
	type TaxBand
} from './payrollMath';

/** The monthly bands as the database holds them: percentage rates, a top band with no limit. */
const BANDS: TaxBand[] = [
	{ threshold: 600, rate: 0, deduction: 0 },
	{ threshold: 1650, rate: 10, deduction: 60 },
	{ threshold: 3200, rate: 15, deduction: 142.5 },
	{ threshold: 5250, rate: 20, deduction: 302.5 },
	{ threshold: 7800, rate: 25, deduction: 565 },
	{ threshold: 10900, rate: 30, deduction: 955 },
	{ threshold: null, rate: 35, deduction: 1500 }
];

describe('income tax', () => {
	it('reads the rate as a percentage, taking the band the income falls under', () => {
		// 5,000 is in the 20% band: 1,000 less the 302.50 deduction.
		expect(incomeTax(5000, BANDS)).toBe(697.5);
		expect(incomeTax(1650, BANDS)).toBe(105);
		expect(incomeTax(600, BANDS)).toBe(0);
	});

	/* The band with no upper limit used to match nothing, so the highest salaries paid no tax. */
	it('taxes income above every threshold at the open-ended band', () => {
		expect(incomeTax(12000, BANDS)).toBe(2700);
	});

	it('uses the highest band when none is open-ended, and never goes below zero', () => {
		const closed = BANDS.slice(0, -1);
		expect(incomeTax(12000, closed)).toBe(2645);
		expect(incomeTax(610, [{ threshold: 1650, rate: 10, deduction: 60 }])).toBe(1);
		expect(incomeTax(100, [{ threshold: 1650, rate: 10, deduction: 60 }])).toBe(0);
		expect(incomeTax(0, BANDS)).toBe(0);
		expect(incomeTax(5000, [])).toBe(0);
	});

	it('does not depend on the order the bands are stored in', () => {
		expect(incomeTax(5000, [...BANDS].reverse())).toBe(697.5);
	});
});

/*
 * The proclamation gives bands and rates; the deductions in `CURRENT_TAX_BANDS` were derived from
 * them. This is the proof they are right: taxing each slice of income at its own band's rate — the
 * progressive tax the law describes — must give exactly what the quick-deduction form gives.
 */
describe('the current bands', () => {
	const bands: TaxBand[] = CURRENT_TAX_BANDS.map((b) => ({ ...b }));

	/** Tax the long way: each slice of income at the rate of the band it falls in. */
	function progressive(income: number): number {
		let tax = 0;
		let floor = 0;
		for (const band of bands) {
			const top = band.threshold ?? Infinity;
			if (income > floor) tax += ((Math.min(income, top) - floor) * band.rate) / 100;
			floor = top;
		}
		return Math.round(tax * 100) / 100;
	}

	it('have deductions that reproduce the progressive tax at every income', () => {
		for (let income = 0; income <= 30000; income += 25) {
			expect([income, incomeTax(income, bands)]).toEqual([income, progressive(income)]);
		}
	});

	it('exempt the first 2,000 birr and tax 35% above 14,000', () => {
		expect(incomeTax(2000, bands)).toBe(0);
		expect(incomeTax(4000, bands)).toBe(300);
		expect(incomeTax(20000, bands)).toBe(4950);
	});
});

describe('pension and net pay', () => {
	it('finds each share by who pays it, and counts a missing one as zero', () => {
		expect(
			pensionRates([
				{ party: 'employer', rate: 11 },
				{ party: 'employee', rate: 7 }
			])
		).toEqual({
			employee: 7,
			employer: 11
		});
		expect(pensionRates([])).toEqual({ employee: 0, employer: 0 });
		expect(pension(10000, 7)).toBe(700);
	});

	it('takes only the employee’s pension share out of net pay', () => {
		expect(
			netPay({
				gross: 10000,
				tax: 2045,
				absenceDeduction: 333.33,
				deductions: 200,
				employeePension: 700
			})
		).toBe(6721.67);
	});
});

/*
 * The payroll run computes tax in SQL, a payslip adjustment in JavaScript. Both come from this
 * module, and this is what keeps them the same rule: the SQL form evaluated by the database on the
 * same incomes must give the same figures.
 */
describe('income tax in SQL agrees with income tax in JavaScript', async () => {
	const { db } = await import('$lib/server/db');

	it('on every band edge and either side of it', async () => {
		const incomes = [0, 450, 600, 601, 1650, 2000, 3200, 5000, 5250, 7800, 10900, 10901, 25000];
		for (const bands of [BANDS, BANDS.slice(0, -1), [...BANDS].reverse(), BANDS.slice(0, 1)]) {
			for (const income of incomes) {
				const [row] = await db
					.select({ tax: incomeTaxSql(sql`${income}`, bands) })
					.from(sql`(SELECT 1) AS one`);
				expect([income, Number(row.tax)]).toEqual([income, incomeTax(income, bands)]);
			}
		}
	});
});
