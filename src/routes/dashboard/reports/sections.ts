/**
 * The ledgers the report can put on the table below the charts.
 *
 * Only one is fetched per request. The charts and tiles above are aggregates
 * and stay cheap no matter how much history the range covers, but the detail
 * rows are the expensive part, so the page pays for exactly the one being read.
 */

export type SectionKey =
	// Payroll
	| 'payroll-runs'
	| 'payroll-entries'
	| 'payroll-adjustments'
	| 'payroll-receipts'
	| 'salary-changes'
	// People
	| 'employees'
	| 'hires'
	| 'terminations'
	// Compensation
	| 'bonuses'
	| 'overtime'
	| 'deductions'
	// Time
	| 'attendance'
	| 'leaves'
	| 'leave-grants'
	// Stock
	| 'supply-adjustments'
	| 'damaged-supplies'
	| 'stock'
	// Money
	| 'transactions'
	| 'expenses'
	| 'services-rendered'
	// Commercial
	| 'customers'
	| 'branches'
	// Clinic — loaded by `clinic.server.ts`, not `details.server.ts`
	| 'production'
	| 'procedures-by-service'
	| 'case-acceptance'
	| 'recalls-due'
	| 'receivables-aging'
	| 'cash-variance'
	| 'lab-turnaround'
	// System
	| 'audit-log'
	| 'patient-access';

export type SectionGroup =
	'Clinic' | 'Payroll' | 'People' | 'Compensation' | 'Time & Leave' | 'Stock' | 'Money' | 'System';

export type SectionMeta = {
	key: SectionKey;
	label: string;
	group: SectionGroup;
	/** Shown under the table heading so the row count is never ambiguous. */
	description: string;
	/** Columns the in-table facet filter offers for this section. */
	filterKeys: string[];
};

export const SECTIONS: SectionMeta[] = [
	{
		key: 'production',
		label: 'Production by Dentist',
		group: 'Clinic',
		description: 'Each dentist’s completed work in the range: procedures, patients and fees.',
		filterKeys: []
	},
	{
		key: 'procedures-by-service',
		label: 'Procedures by Service',
		group: 'Clinic',
		description: 'How often each service was completed in the range, and what it earned.',
		filterKeys: []
	},
	{
		key: 'case-acceptance',
		label: 'Case Acceptance',
		group: 'Clinic',
		description: 'Treatment plans presented in the range: what was quoted and what was agreed.',
		filterKeys: ['status']
	},
	{
		key: 'recalls-due',
		label: 'Recalls',
		group: 'Clinic',
		description: 'Recalls that fell due in the range, and whether the patient came back.',
		filterKeys: ['status', 'visit']
	},
	{
		key: 'receivables-aging',
		label: 'Receivables Aging',
		group: 'Clinic',
		description: 'Every issued bill still owing today, by how long ago it was issued.',
		filterKeys: ['bucket', 'payer']
	},
	{
		key: 'cash-variance',
		label: 'Cash Drawer Counts',
		group: 'Clinic',
		description: 'Drawers closed in the range: what was expected, what was counted.',
		filterKeys: ['closedBy']
	},
	{
		key: 'lab-turnaround',
		label: 'Lab Turnaround',
		group: 'Clinic',
		description: 'Work sent to each laboratory in the range: days taken, lateness and remakes.',
		filterKeys: []
	},

	{
		key: 'payroll-runs',
		label: 'Payroll Runs',
		group: 'Payroll',
		description: 'One row per month the company ran payroll, with every total on it.',
		filterKeys: ['month', 'year', 'finalized']
	},
	{
		key: 'payroll-entries',
		label: 'Payslips',
		group: 'Payroll',
		description: 'Every individual payslip issued inside the range.',
		filterKeys: ['month', 'year', 'department', 'branch', 'status', 'paymentMethod']
	},
	{
		key: 'payroll-adjustments',
		label: 'Payroll Adjustments',
		group: 'Payroll',
		description: 'Bonuses and deductions applied on top of a payslip after the fact.',
		filterKeys: ['adjustmentType', 'employee', 'month', 'year']
	},
	{
		key: 'payroll-receipts',
		label: 'Payroll Payments',
		group: 'Payroll',
		description: 'The money actually sent out for each payroll run.',
		filterKeys: ['paidDate']
	},
	{
		key: 'salary-changes',
		label: 'Salary Changes',
		group: 'Payroll',
		description: 'Every salary record that took effect inside the range.',
		filterKeys: ['employee', 'department', 'position', 'branch', 'changeReason']
	},

	{
		key: 'employees',
		label: 'Employee Roster',
		group: 'People',
		description: 'Everyone on the books, filtered by the query above.',
		filterKeys: [
			'department',
			'position',
			'status',
			'branch',
			'gender',
			'education',
			'maritalStatus'
		]
	},
	{
		key: 'hires',
		label: 'New Hires',
		group: 'People',
		description: 'Employees whose hire date falls inside the range.',
		filterKeys: ['department', 'position', 'branch', 'gender', 'status']
	},
	{
		key: 'terminations',
		label: 'Terminations',
		group: 'People',
		description: 'Employees let go inside the range, with the recorded reason.',
		filterKeys: ['department', 'branch', 'gender', 'reason']
	},

	{
		key: 'bonuses',
		label: 'Bonuses',
		group: 'Compensation',
		description: 'Ad-hoc bonuses paid inside the range.',
		filterKeys: ['employee', 'department', 'branch', 'description']
	},
	{
		key: 'overtime',
		label: 'Overtime',
		group: 'Compensation',
		description: 'Overtime logged inside the range, by type and hours.',
		filterKeys: ['employee', 'department', 'branch', 'type']
	},
	{
		key: 'deductions',
		label: 'Deductions',
		group: 'Compensation',
		description: 'Deductions and warnings recorded inside the range.',
		filterKeys: ['employee', 'department', 'type', 'warningType']
	},

	{
		key: 'attendance',
		label: 'Attendance',
		group: 'Time & Leave',
		description: 'Absences, excused days and late arrivals inside the range, from the register.',
		filterKeys: ['employee', 'department', 'branch', 'status']
	},
	{
		key: 'leaves',
		label: 'Leave Requests',
		group: 'Time & Leave',
		description: 'Leave requested inside the range, with status and days taken.',
		filterKeys: ['employee', 'department', 'leaveType', 'status']
	},
	{
		key: 'leave-grants',
		label: 'Leave Grants',
		group: 'Time & Leave',
		description: 'Annual leave granted, spent, and expired per service year.',
		filterKeys: ['employee', 'department', 'status', 'serviceYear']
	},

	{
		key: 'supply-adjustments',
		label: 'Stock Movements',
		group: 'Stock',
		description: 'Everything added to or taken out of stock inside the range.',
		filterKeys: ['supply', 'supplyType', 'supplier', 'direction', 'employee']
	},
	{
		key: 'damaged-supplies',
		label: 'Damaged Stock',
		group: 'Stock',
		description: 'Damage reports filed inside the range.',
		filterKeys: ['supply', 'supplyType', 'employee', 'deductable']
	},
	{
		key: 'stock',
		label: 'Stock On Hand',
		group: 'Stock',
		description: 'Current levels for every supply, and what is below its reorder line.',
		filterKeys: ['supplyType', 'belowReorder', 'unitOfMeasure']
	},

	{
		key: 'transactions',
		label: 'Transactions',
		group: 'Money',
		description: 'Every transaction recorded inside the range.',
		filterKeys: ['paymentStatus', 'paymentMethod']
	},
	{
		key: 'expenses',
		label: 'Expenses',
		group: 'Money',
		description: 'Company expenses booked inside the range.',
		filterKeys: ['type', 'paymentMethod']
	},
	{
		key: 'services-rendered',
		label: 'Services Rendered',
		group: 'Money',
		description: 'Work billed on bills issued inside the range, line by line.',
		filterKeys: ['service', 'employee']
	},

	{
		key: 'customers',
		label: 'Customers',
		// Was 'Commercial'. That page was entirely client contracts and went with them; these two
		// sections still carry real data, so they sit under People until patients and branches
		// give them a page of their own.
		group: 'People',
		description: 'Customers on the books, and when they were added.',
		filterKeys: ['status']
	},
	{
		key: 'branches',
		label: 'Branches',
		group: 'People',
		description: 'Clinic locations, and when they opened.',
		filterKeys: ['isActive']
	},

	{
		key: 'audit-log',
		label: 'Audit Trail',
		group: 'System',
		description: 'Who changed what inside the range.',
		filterKeys: ['action', 'tableName', 'user']
	},
	{
		key: 'patient-access',
		label: 'Patient Record Access',
		group: 'System',
		description:
			'Who opened which patient’s chart inside the range. Search a name to follow one person.',
		filterKeys: ['user', 'part', 'branch']
	}
];

export const SECTION_GROUPS: SectionGroup[] = [
	'Clinic',
	'Payroll',
	'People',
	'Compensation',
	'Time & Leave',
	'Stock',
	'Money',
	'System'
];

export function sectionMeta(key: string): SectionMeta {
	return SECTIONS.find((section) => section.key === key) ?? SECTIONS[0];
}

/**
 * One report page per domain.
 *
 * The split is the same one the section groups already describe, so a group is
 * a page: each route loads exactly one analytics module and shows only the
 * tiles, charts and ledgers belonging to it. Reading the whole company at once
 * was the old single page, and it was too much to take in.
 */
export type ReportPage = {
	slug: string;
	group: SectionGroup;
	title: string;
	/** One line on the link map saying what the page answers. */
	blurb: string;
};

export const REPORT_PAGES: ReportPage[] = [
	{
		slug: 'clinic',
		group: 'Clinic',
		title: 'Clinic',
		blurb: 'Production, case acceptance, recalls, what is owed, the cash drawer and lab work.'
	},
	{
		slug: 'people',
		group: 'People',
		title: 'People',
		blurb: 'Headcount, hires, terminations, tenure and the shape of the workforce.'
	},
	{
		slug: 'payroll',
		group: 'Payroll',
		title: 'Payroll',
		blurb: 'What payroll cost, what it was made of, and who it went to.'
	},
	{
		slug: 'compensation',
		group: 'Compensation',
		title: 'Compensation',
		blurb: 'Bonuses, overtime, commission and deductions on top of salary.'
	},
	{
		slug: 'leave',
		group: 'Time & Leave',
		title: 'Time & Leave',
		blurb: 'Absence, leave requested, and the leave balance sitting on the books.'
	},
	{
		slug: 'stock',
		group: 'Stock',
		title: 'Stock',
		blurb: 'What came into the store room, what left it, and what is running low.'
	},
	{
		slug: 'money',
		group: 'Money',
		title: 'Money',
		blurb: 'Transactions, expenses and service revenue.'
	},
	{
		slug: 'system',
		group: 'System',
		title: 'System',
		blurb: 'Who changed what, and whether the scheduled jobs are still firing.'
	}
];

export function pageForGroup(group: SectionGroup): ReportPage {
	return REPORT_PAGES.find((page) => page.group === group) ?? REPORT_PAGES[0];
}

/** The route a stat tile jumps to when its ledger lives on another page. */
export function pageForSection(key: string): ReportPage {
	return pageForGroup(sectionMeta(key).group);
}

export function sectionsInGroup(group: SectionGroup): SectionMeta[] {
	return SECTIONS.filter((section) => section.group === group);
}

/**
 * The ledger a page opens on. A `section` left over in the URL from another
 * report would otherwise ask this page to render a table it has no columns
 * for, so anything foreign falls back to the group's first ledger.
 */
export function resolveSection(requested: string | undefined, group: SectionGroup): string {
	const inGroup = sectionsInGroup(group);
	const match = inGroup.find((section) => section.key === requested);
	return (match ?? inGroup[0]).key;
}
