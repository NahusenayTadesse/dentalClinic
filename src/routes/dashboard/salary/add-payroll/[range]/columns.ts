import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB } from '$lib/global.svelte';
import type { PageData } from './$types';

/** One unpaid payslip, as `server/payrollRun.ts` computes it. */
type Row = PageData['payrollData'][number];

const money = (value: number) => formatETB(value);

/** A money column whose id is also what the totals and the sort read. */
function amount(id: keyof Row & string, header: string): ColumnDef<Row> {
	return {
		id,
		header,
		accessorFn: (row) => Number(row[id] ?? 0),
		cell: ({ getValue }) => money(Number(getValue()))
	};
}

/**
 * The payslip as the run will pay it, line by line. Ids match the row's fields — the old columns
 * read `transport` and `penOrgAmount`, which no row had, so both showed nothing.
 */
export const payslipColumns: ColumnDef<Row>[] = [
	{
		id: 'name',
		header: 'Employee',
		accessorFn: (row) => row.name,
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				entity: 'employee',
				id: row.original.id,
				name: row.original.name
			})
	},
	{ id: 'department', header: 'Department', accessorFn: (row) => row.department ?? '—' },
	{ id: 'position', header: 'Position', accessorFn: (row) => row.position ?? '—' },
	{ id: 'branch', header: 'Branch', accessorFn: (row) => row.branch ?? '—' },
	{
		id: 'employmentStatus',
		header: 'Employment',
		accessorFn: (row) => row.employmentStatus ?? '—'
	},
	amount('basicSalary', 'Basic'),
	amount('positionAllowance', 'Position allowance'),
	amount('housingAllowance', 'Housing'),
	amount('transportAllowance', 'Transport'),
	amount('nonTaxable', 'Non-taxable'),
	amount('overtime', 'Overtime'),
	amount('bonus', 'Bonus'),
	amount('commission', 'Commission'),
	amount('gross', 'Gross'),
	{ id: 'absent', header: 'Days absent', accessorFn: (row) => row.absent },
	amount('attendancePenality', 'Absence'),
	amount('deductions', 'Deductions'),
	amount('taxable', 'Taxable'),
	amount('taxAmount', 'Income tax'),
	amount('penEm', 'Pension (employee)'),
	amount('penOrg', 'Pension (employer)'),
	amount('netPay', 'Net pay')
];

/** What the bank needs, and nothing else: who, which account, how much. */
export const bankColumns: ColumnDef<Row>[] = [
	{ id: 'name', header: 'Employee', accessorFn: (row) => row.name },
	{ id: 'bank', header: 'Bank', accessorFn: (row) => row.bank ?? '—' },
	{ id: 'account', header: 'Account', accessorFn: (row) => row.account ?? '—' },
	amount('netPay', 'Net pay')
];
