/**
 * The shape of the report query, shared by the loader and the page.
 *
 * Everything lives in the URL so a report is a link: a filtered view can be
 * bookmarked, mailed to an accountant, or reloaded after an export without
 * rebuilding the filter set by hand.
 */

/** Every filter the report understands, already parsed out of the query string. */
export type ReportFilters = {
	dateStart: string;
	dateEnd: string;
	search: string;
	section: string;
	page: number;
	pageSize: number;

	// Who — narrows every staff-scoped dataset (payroll, bonuses, leave, …).
	staffId: number | null;
	departmentId: number | null;
	positionId: number | null;
	employmentStatusId: number | null;
	educationalLevelId: number | null;
	gender: string;

	// Where — narrows sites, contracts, site payments, and staff posted to a site.
	siteId: number | null;
	customerId: number | null;

	// Money
	paymentMethodId: number | null;
	expenseTypeId: number | null;
	transactionStatus: string;
	minAmount: number | null;
	maxAmount: number | null;

	// Stock
	supplyTypeId: number | null;
	supplierId: number | null;

	// Everything else
	serviceId: number | null;
	leaveTypeId: number | null;
	overtimeTypeId: number | null;
	approvalStatus: string;
	payrollStatus: string;
};

/** Numeric params are optional everywhere — an empty string means "no filter". */
function num(value: string | null): number | null {
	if (!value) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
		date.getDate()
	).padStart(2, '0')}`;
}

/**
 * The window the report opens on when nothing is asked for: the trailing twelve
 * months. Long enough that every chart has a shape to it, short enough that the
 * aggregates stay cheap on a database that has years of history in it.
 */
export function defaultRange(): { dateStart: string; dateEnd: string } {
	const end = new Date();
	const start = new Date();
	start.setFullYear(start.getFullYear() - 1);
	start.setDate(start.getDate() + 1);

	return { dateStart: isoDate(start), dateEnd: isoDate(end) };
}

export function parseFilters(url: URL): ReportFilters {
	const params = url.searchParams;
	const fallback = defaultRange();

	return {
		dateStart: params.get('dateStart') || fallback.dateStart,
		dateEnd: params.get('dateEnd') || fallback.dateEnd,
		search: params.get('search')?.trim() ?? '',
		// Left raw on purpose: which ledger is valid depends on the report page,
		// so each one resolves this against its own group via `resolveSection`.
		section: params.get('section') ?? '',
		page: Math.max(1, num(params.get('page')) ?? 1),
		pageSize: Math.min(500, Math.max(5, num(params.get('pageSize')) ?? 25)),

		staffId: num(params.get('staffId')),
		departmentId: num(params.get('departmentId')),
		positionId: num(params.get('positionId')),
		employmentStatusId: num(params.get('employmentStatusId')),
		educationalLevelId: num(params.get('educationalLevelId')),
		gender: params.get('gender') ?? '',

		siteId: num(params.get('siteId')),
		customerId: num(params.get('customerId')),

		paymentMethodId: num(params.get('paymentMethodId')),
		expenseTypeId: num(params.get('expenseTypeId')),
		transactionStatus: params.get('transactionStatus') ?? '',
		minAmount: num(params.get('minAmount')),
		maxAmount: num(params.get('maxAmount')),

		supplyTypeId: num(params.get('supplyTypeId')),
		supplierId: num(params.get('supplierId')),

		serviceId: num(params.get('serviceId')),
		leaveTypeId: num(params.get('leaveTypeId')),
		overtimeTypeId: num(params.get('overtimeTypeId')),
		approvalStatus: params.get('approvalStatus') ?? '',
		payrollStatus: params.get('payrollStatus') ?? ''
	};
}

/** The custom-filter keys the query builder renders, in the order it renders them. */
export const CUSTOM_FILTER_KEYS = [
	'departmentId',
	'positionId',
	'siteId',
	'customerId',
	'employmentStatusId',
	'educationalLevelId',
	'gender',
	'staffId',
	'paymentMethodId',
	'expenseTypeId',
	'transactionStatus',
	'supplyTypeId',
	'supplierId',
	'serviceId',
	'leaveTypeId',
	'overtimeTypeId',
	'approvalStatus',
	'payrollStatus',
	'minAmount',
	'maxAmount'
] as const;

export type CustomFilterKey = (typeof CUSTOM_FILTER_KEYS)[number];
