import type { PageServerLoad } from './$types';
import { parseFilters } from './filters';
import { peopleStats } from './analytics/people.server';
import { payrollStats } from './analytics/payroll.server';
import { compensationStats } from './analytics/compensation.server';
import { timeStats } from './analytics/time.server';
import { stockStats } from './analytics/stock.server';
import { moneyStats } from './analytics/money.server';
import { systemStats } from './analytics/system.server';
import type { Stat } from './types';

type Domain = { stats: Stat[] };

/**
 * The overview is the only page that reads every domain, and it shows just the
 * headline number from each — the detail lives on the report it belongs to.
 * A domain that fails leaves its card empty rather than taking the page down.
 */
async function safe(name: string, run: () => Promise<Domain>): Promise<Stat[]> {
	try {
		return (await run()).stats;
	} catch (error) {
		console.error(`[reports] overview ${name} failed`, error);
		return [];
	}
}

/**
 * The four figures that stand for each report on the landing page. Anything
 * not listed here is still computed — it is just left for the report itself,
 * which is the whole point of splitting the pages up.
 */
const HEADLINES = new Set([
	'headcount',
	'hired',
	'terminated',
	'turnover',

	'payroll-net',
	'payroll-gross',
	'payslips',
	'payroll-tax',

	'bonuses',
	'overtime-amount',
	'commissions',
	'deductions',

	'absences',
	'leave-days',
	'leave-granted',
	'absence-pending',

	'stock-added',
	'stock-taken',
	'stock-purchase-cost',
	'stock-below-reorder',

	'transaction-value',
	'expenses',
	'bank-net',
	'bank-balance',

	'revenue-collected',
	'requests-raised',
	'collection-rate',
	'contract-book',

	'audit-entries',
	'audit-users',
	'job-runs',
	'job-failures'
]);

export const load: PageServerLoad = async ({ url }) => {
	const filters = parseFilters(url);

	const domains = await Promise.all([
		safe('people', () => peopleStats(filters)),
		safe('payroll', () => payrollStats(filters)),
		safe('compensation', () => compensationStats(filters)),
		safe('time', () => timeStats(filters)),
		safe('stock', () => stockStats(filters)),
		safe('money', () => moneyStats(filters)),
		safe('system', () => systemStats(filters))
	]);

	return {
		stats: domains.flat().filter((stat) => HEADLINES.has(stat.key))
	};
};
