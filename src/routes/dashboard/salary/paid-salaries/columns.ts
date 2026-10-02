import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { PageData } from './$types';

/** One payslip, as the load returns it. */
type Row = PageData['rows'][number];

/** A money cell: a payslip column left empty reads as a dash, not as zero birr. */
const money = (value: number | null) => (value === null ? '—' : formatETB(value));

/**
 * The paid salaries columns. Ids match the facet and sort keys (`server/payslips.ts`); the run
 * opens that month's own page, with its receipts, adjustments and finalising.
 */
export const payslipColumns: ColumnDef<Row>[] = [
	{
		id: 'period',
		header: 'Month',
		accessorFn: (row) => row.periodLabel,
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: encodeURIComponent(row.original.period),
				name: row.original.periodLabel,
				link: '/dashboard/salary/paid-salaries'
			})
	},
	{
		id: 'employee',
		header: 'Employee',
		accessorFn: (row) => row.employee,
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				entity: 'employee',
				id: row.original.staffId,
				name: row.original.employee
			})
	},
	{ id: 'department', header: 'Department', accessorFn: (row) => row.department ?? '—' },
	{ id: 'position', header: 'Position', accessorFn: (row) => row.position ?? '—' },
	{
		id: 'basic',
		header: 'Basic',
		accessorFn: (row) => row.basic,
		cell: ({ row }) => money(row.original.basic)
	},
	{
		id: 'overtime',
		header: 'Overtime',
		accessorFn: (row) => row.overtime,
		cell: ({ row }) => money(row.original.overtime)
	},
	{
		id: 'bonus',
		header: 'Bonus',
		accessorFn: (row) => row.bonus,
		cell: ({ row }) => money(row.original.bonus)
	},
	{
		id: 'commission',
		header: 'Commission',
		accessorFn: (row) => row.commission,
		cell: ({ row }) => money(row.original.commission)
	},
	{
		id: 'gross',
		header: 'Gross',
		accessorFn: (row) => row.gross,
		cell: ({ row }) => money(row.original.gross)
	},
	{
		id: 'tax',
		header: 'Income tax',
		accessorFn: (row) => row.tax,
		cell: ({ row }) => money(row.original.tax)
	},
	{
		id: 'pension',
		header: 'Pension',
		accessorFn: (row) => row.pension,
		cell: ({ row }) => money(row.original.pension)
	},
	{
		id: 'deductions',
		header: 'Deductions',
		accessorFn: (row) => row.deductions,
		cell: ({ row }) => money(row.original.deductions)
	},
	{
		id: 'absence',
		header: 'Absence',
		accessorFn: (row) => row.absence,
		cell: ({ row }) => money(row.original.absence)
	},
	{
		id: 'net',
		header: 'Net pay',
		accessorFn: (row) => row.net,
		cell: ({ row }) => money(row.original.net)
	},
	{ id: 'paymentMethod', header: 'Paid through', accessorFn: (row) => row.paymentMethod ?? '—' },
	{
		id: 'paidOn',
		header: 'Paid on',
		accessorFn: (row) => row.paidOn,
		cell: ({ row }) => ethiopianDate(row.original.paidOn)
	},
	{ id: 'status', header: 'Status', accessorFn: (row) => row.status }
];
