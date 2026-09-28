import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import BigText from '$lib/components/Table/bigText.svelte';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import type { SectionKey } from './sections';

/**
 * Column definitions for every ledger the report can show.
 *
 * Twenty-eight tables written out longhand would be several thousand lines of
 * near-identical TanStack config, so each column is declared as `[key, label,
 * kind]` and expanded by `build` below. Adding a column to a section is one
 * line, and every section formats money, dates and statuses the same way.
 */
type Kind =
	/** Plain string. */
	| 'text'
	/** Currency, right-aligned and formatted in ETB. */
	| 'money'
	/** Bare number — hours, days, quantities. */
	| 'number'
	/** `YYYY-MM-DD` rendered in the Ethiopian calendar. */
	| 'date'
	/** Coloured badge via the shared status component. */
	| 'status'
	/** Long free text, collapsed behind a popover. */
	| 'long'
	/** Links through to the record's own page. */
	| 'link';

type Column = [key: string, label: string, kind?: Kind, link?: string];

const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function cell(kind: Kind, link?: string) {
	switch (kind) {
		case 'money':
			return (info: { getValue: () => unknown }) => {
				const value = info.getValue();
				return value === null || value === undefined ? '—' : formatETB(Number(value), true);
			};
		case 'number':
			return (info: { getValue: () => unknown }) => {
				const value = info.getValue();
				return value === null || value === undefined ? '—' : NUMBER.format(Number(value));
			};
		case 'date':
			return (info: { getValue: () => unknown }) => {
				const value = info.getValue();
				if (!value) return '—';
				const parsed = new Date(String(value));
				return Number.isNaN(parsed.getTime()) ? String(value) : formatEthiopianDate(parsed);
			};
		case 'status':
			return (info: { getValue: () => unknown }) => {
				const value = info.getValue();
				if (!value) return '—';
				return renderComponent(Statuses, { status: String(value) });
			};
		case 'long':
			return (info: { getValue: () => unknown }) => {
				const value = info.getValue();
				if (!value) return '—';
				return renderComponent(BigText, { text: String(value) });
			};
		case 'link':
			return (info: { getValue: () => unknown; row: { original: Record<string, unknown> } }) => {
				const value = info.getValue();
				if (!value) return '—';
				return renderComponent(DataTableLinks, {
					id: String(info.row.original.id ?? ''),
					name: String(value),
					link: link ?? ''
				});
			};
		default:
			return (info: { getValue: () => unknown }) => {
				const value = info.getValue();
				return value === null || value === undefined || value === '' ? '—' : String(value);
			};
	}
}

function build(columns: Column[]) {
	return [
		{
			id: 'index',
			header: '#',
			cell: (info: {
				table: { getRowModel: () => { rows: { id: string }[] } };
				row: { id: string };
			}) => info.table.getRowModel().rows.findIndex((row) => row.id === info.row.id) + 1,
			enableSorting: false
		},
		...columns.map(([key, label, kind = 'text', link]) => ({
			accessorKey: key,
			header: ({
				column
			}: {
				column: { getToggleSortingHandler: () => ((event: MouseEvent) => void) | undefined };
			}) =>
				renderComponent(DataTableSort, {
					name: label,
					onclick: column.getToggleSortingHandler()
				}),
			cell: cell(kind, link)
		}))
	];
}

const EMPLOYEE_LINK = '/dashboard/employees';
const BRANCH_LINK = '/dashboard/admin-panel/branches';

const DEFINITIONS: Record<SectionKey, Column[]> = {
	'payroll-runs': [
		['month', 'Month'],
		['year', 'Year'],
		['totalSalaries', 'Salaries', 'money'],
		['totalOvertime', 'Overtime', 'money'],
		['totalTransport', 'Transport', 'money'],
		['totalHousing', 'Housing', 'money'],
		['totalPosition', 'Position', 'money'],
		['totalGross', 'Gross', 'money'],
		['totalTax', 'Tax', 'money'],
		['totalDeductions', 'Deductions', 'money'],
		['totalPenalities', 'Penalties', 'money'],
		['penEm', 'Pension (Employee)', 'money'],
		['penOrg', 'Pension (Company)', 'money'],
		['totalNet', 'Net', 'money'],
		['finalized', 'Finalised', 'status'],
		['finalizedAt', 'Finalised On', 'date'],
		['finalizedBy', 'Finalised By']
	],

	'payroll-entries': [
		['employee', 'Employee'],
		['department', 'Department'],
		['branch', 'Branch'],
		['month', 'Month'],
		['year', 'Year'],
		['periodStart', 'Period Start', 'date'],
		['periodEnd', 'Period End', 'date'],
		['basicSalary', 'Basic', 'money'],
		['overtime', 'Overtime', 'money'],
		['bonus', 'Bonus', 'money'],
		['commission', 'Commission', 'money'],
		['transport', 'Transport', 'money'],
		['housing', 'Housing', 'money'],
		['positionAllowance', 'Position', 'money'],
		['nonTaxable', 'Non-Taxable', 'money'],
		['gross', 'Gross', 'money'],
		['tax', 'Tax', 'money'],
		['deductions', 'Deductions', 'money'],
		['attendancePenalty', 'Attendance Penalty', 'money'],
		['penEm', 'Pension (Employee)', 'money'],
		['penOrg', 'Pension (Company)', 'money'],
		['net', 'Net', 'money'],
		['paid', 'Paid', 'money'],
		['status', 'Status', 'status'],
		['paymentMethod', 'Method'],
		['paymentDate', 'Paid On', 'date']
	],

	'payroll-adjustments': [
		['date', 'Date', 'date'],
		['employee', 'Employee'],
		['adjustmentType', 'Type', 'status'],
		['amount', 'Amount', 'money'],
		['gross', 'Gross After', 'money'],
		['net', 'Net After', 'money'],
		['month', 'Month'],
		['year', 'Year'],
		['reason', 'Reason', 'long']
	],

	'payroll-receipts': [
		['paidDate', 'Paid On', 'date'],
		['month', 'Month'],
		['year', 'Year'],
		['periodStart', 'Period Start', 'date'],
		['periodEnd', 'Period End', 'date'],
		['amount', 'Amount', 'money'],
		['employees', 'Employees', 'number'],
		['receipt', 'Receipt', 'long']
	],

	'salary-changes': [
		['employee', 'Employee'],
		['department', 'Department'],
		['position', 'Position'],
		['branch', 'Branch'],
		['amount', 'Salary', 'money'],
		['transport', 'Transport', 'money'],
		['housing', 'Housing', 'money'],
		['positionAllowance', 'Position', 'money'],
		['nonTax', 'Non-Taxable', 'money'],
		['percentage', 'Commission %', 'number'],
		['startDate', 'From', 'date'],
		['endDate', 'To', 'date'],
		['changeReason', 'Reason', 'long']
	],

	employees: [
		['employee', 'Employee', 'link', EMPLOYEE_LINK],
		['idNo', 'ID No'],
		['gender', 'Gender'],
		['department', 'Department'],
		['position', 'Position'],
		['branch', 'Branch'],
		['status', 'Status', 'status'],
		['education', 'Education'],
		['maritalStatus', 'Marital Status'],
		['salary', 'Current Salary', 'money'],
		['leavesLeft', 'Leave Days', 'number'],
		['hireDate', 'Hired', 'date'],
		['birthDate', 'Born', 'date'],
		['terminationDate', 'Terminated', 'date']
	],

	hires: [
		['employee', 'Employee', 'link', EMPLOYEE_LINK],
		['idNo', 'ID No'],
		['gender', 'Gender'],
		['department', 'Department'],
		['position', 'Position'],
		['branch', 'Branch'],
		['status', 'Status', 'status'],
		['education', 'Education'],
		['salary', 'Starting Salary', 'money'],
		['hireDate', 'Hired', 'date']
	],

	terminations: [
		['employee', 'Employee'],
		['gender', 'Gender'],
		['department', 'Department'],
		['branch', 'Branch'],
		['hireDate', 'Hired', 'date'],
		['terminationDate', 'Terminated', 'date'],
		['tenureYears', 'Years Served', 'number'],
		['reason', 'Reason', 'long'],
		['letter', 'Letter', 'long']
	],

	bonuses: [
		['date', 'Date', 'date'],
		['employee', 'Employee'],
		['department', 'Department'],
		['branch', 'Branch'],
		['amount', 'Amount', 'money'],
		['description', 'Description', 'long']
	],

	overtime: [
		['date', 'Date', 'date'],
		['employee', 'Employee'],
		['department', 'Department'],
		['branch', 'Branch'],
		['type', 'Type'],
		['hours', 'Hours', 'number'],
		['rate', 'Rate', 'money'],
		['amount', 'Amount', 'money'],
		['reason', 'Reason', 'long']
	],

	deductions: [
		['date', 'Date', 'date'],
		['employee', 'Employee'],
		['department', 'Department'],
		['type', 'Type'],
		['amount', 'Amount', 'money'],
		['reason', 'Reason', 'long'],
		['warningType', 'Warning'],
		['warningReason', 'Warning Reason', 'long']
	],

	attendance: [
		['date', 'Date', 'date'],
		['employee', 'Employee'],
		['department', 'Department'],
		['branch', 'Branch'],
		['deductable', 'Deductable', 'status'],
		['amount', 'Docked', 'money'],
		['approval', 'Approval', 'status'],
		['reason', 'Reason', 'long']
	],

	leaves: [
		['employee', 'Employee'],
		['department', 'Department'],
		['leaveType', 'Leave Type'],
		['requestDate', 'Requested', 'date'],
		['startDate', 'From', 'date'],
		['endDate', 'To', 'date'],
		['days', 'Days', 'number'],
		['status', 'Status', 'status'],
		['approvedBy', 'Approved By'],
		['reason', 'Reason', 'long']
	],

	'leave-grants': [
		['employee', 'Employee'],
		['department', 'Department'],
		['serviceYear', 'Service Year', 'number'],
		['grantDate', 'Granted', 'date'],
		['expiryDate', 'Expires', 'date'],
		['granted', 'Days Granted', 'number'],
		['used', 'Days Used', 'number'],
		['remaining', 'Days Left', 'number'],
		['status', 'Status', 'status']
	],

	'supply-adjustments': [
		['date', 'Date', 'date'],
		['supply', 'Supply'],
		['supplyType', 'Type'],
		['direction', 'Direction'],
		['adjustment', 'Change', 'number'],
		['costPerItem', 'Unit Cost', 'money'],
		['total', 'Total', 'money'],
		['supplier', 'Supplier'],
		['employee', 'Handled By'],
		['reason', 'Reason', 'long']
	],

	'damaged-supplies': [
		['date', 'Date', 'date'],
		['supply', 'Supply'],
		['supplyType', 'Type'],
		['quantity', 'Units', 'number'],
		['employee', 'Damaged By'],
		['deductable', 'Charged To Staff', 'status'],
		['reason', 'Reason', 'long']
	],

	stock: [
		['supply', 'Supply'],
		['supplyType', 'Type'],
		['quantity', 'On Hand', 'number'],
		['unitOfMeasure', 'Unit'],
		['reorderLevel', 'Reorder At', 'number'],
		['belowReorder', 'Needs Reorder', 'status'],
		['description', 'Description', 'long']
	],

	transactions: [
		['date', 'Date', 'date'],
		['description', 'Description', 'long'],
		['amount', 'Amount', 'money'],
		['paymentStatus', 'Status', 'status'],
		['paymentMethod', 'Method'],
		['recordedBy', 'Recorded By'],
		['receipt', 'Receipt', 'long']
	],

	expenses: [
		['date', 'Date', 'date'],
		['type', 'Type'],
		['description', 'Description', 'long'],
		['amount', 'Amount', 'money'],
		['paymentMethod', 'Method'],
		['paymentStatus', 'Status', 'status'],
		['recordedBy', 'Recorded By'],
		['receipt', 'Receipt', 'long']
	],

	'services-rendered': [
		['date', 'Date', 'date'],
		['bill', 'Bill'],
		['service', 'Service'],
		['employee', 'Clinician'],
		['quantity', 'Qty'],
		['price', 'Price', 'money'],
		['total', 'Total', 'money'],
		['paymentStatus', 'Status', 'status']
	],

	customers: [
		['customer', 'Customer'],
		['status', 'Status', 'status'],
		['phone', 'Phone'],
		['email', 'Email'],
		['tinNo', 'TIN'],
		['addedOn', 'Added', 'date']
	],

	branches: [
		['branch', 'Branch', 'link', BRANCH_LINK],
		['phone', 'Phone'],
		['openedOn', 'Opened', 'date'],
		['isActive', 'Status', 'status']
	],

	'audit-log': [
		['at', 'When'],
		['user', 'User'],
		['action', 'Action'],
		['tableName', 'Table'],
		['recordId', 'Record'],
		['ipAddress', 'IP']
	]
};

/** TanStack column defs for one section, built on demand. */
export function columnsFor(section: string) {
	const definition = DEFINITIONS[section as SectionKey] ?? DEFINITIONS['payroll-runs'];
	return build(definition);
}
