import { ethiopianDate } from '$lib/tableCells';
import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';

/** One row of the table this file describes, taken from the load so the two cannot drift. */
type RowData = NonNullable<PageData['salaryHistory']>[number];

import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
// Assuming a new actions component
import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
import { formatETB } from '$lib/global.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { User } from '@lucide/svelte';
import Statuses from '$lib/components/Table/statuses.svelte';

/** A decimal column's value for `formatETB`: the driver hands decimals back as strings. */
const amount = (value: unknown) => (value === null || value === undefined ? null : Number(value));

export const columns: ColumnDef<RowData>[] = [
	// 1. Row Index
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => {
			const rowIndex = info.table.getRowModel().rows.findIndex((row) => row.id === info.row.id);
			return rowIndex + 1;
		}
	},
	{
		accessorKey: 'department',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Department',
				onclick: column.getToggleSortingHandler()
			})
	},
	{
		accessorKey: 'position',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Position',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'branch',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Branches',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.branchId,
				name: row.original.branch,
				link: '/dashboard/branches'
			});
		}
	},

	{
		accessorKey: 'amount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Salary',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatETB(amount(info.getValue()), true);
		}
	},
	{
		accessorKey: 'housingAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Housing Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatETB(amount(info.getValue()), true);
		}
	},
	{
		accessorKey: 'transportationAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Transportation Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatETB(amount(info.getValue()), true);
		}
	},

	{
		accessorKey: 'positionAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Position Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatETB(amount(info.getValue()), true);
		}
	},

	{
		accessorKey: 'nonTaxAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Non Tax Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatETB(amount(info.getValue()), true);
		}
	},

	{
		accessorKey: 'officeCommission',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Office Commission',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return renderComponent(Statuses, {
				status: info.getValue() ? 'Yes' : 'No'
			});
		}
	},

	{
		accessorKey: 'percentage',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Non Tax Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return Number(info.getValue()) + '%';
		}
	},
	{
		accessorKey: 'startDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Start Date',
				onclick: column.getToggleSortingHandler()
			}),
		// Show 'N/A' if the payroll entry is null
		// `ethiopianDate` takes the ISO day the column now returns (`mode: 'string'`).
		cell: (info) => (info.getValue() ? ethiopianDate(info.getValue()) : 'Salary Not Entered'),
		enableSorting: false // Usually not sortable
	},

	{
		accessorKey: 'endDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'End Date',
				onclick: column.getToggleSortingHandler()
			}),
		// Show 'N/A' if the payroll entry is null
		cell: (info) => (info.getValue() ? ethiopianDate(info.getValue()) : 'Current Salary'),
		enableSorting: false // Usually not sortable
	},

	{
		accessorKey: 'changedBy',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Changed By',
				onclick: column.getToggleSortingHandler()
			}),
		// Show 'N/A' if the payroll entry is null
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.changedById,
				name: row.original.changedBy,
				link: `/dashboard/admin-panel/users`,
				target: '_blank',
				IconComp: User
			})
	}
];
