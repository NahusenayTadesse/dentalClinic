import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';

/** One row of the table this file describes, taken from the load so the two cannot drift. */
type RowData = NonNullable<PageData['salaryHistory']>[number];

import { renderComponent } from '$lib/components/ui/data-table/index.js';
// Assuming a new actions component
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
// NOTE: You must ensure your backend query includes 'name' and 'position'
// from the staff table to display them here!
// e.g., staffName: staff.name, staffPosition: staff.category

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
	// --- Payroll Specific Fields ---
	{
		accessorKey: 'requestDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Request Date',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatEthiopianDate(info.getValue());
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
		cell: (info) => formatEthiopianDate(info.getValue()) || 'Leave Not Entered',
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
		cell: (info) => formatEthiopianDate(info.getValue()) || 'Leave Not Entered',
		enableSorting: false // Usually not sortable
	},

	{
		accessorKey: 'numberOfDays',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Number of Days',
				onclick: column.getToggleSortingHandler()
			}),
		// Show 'N/A' if the payroll entry is null
		cell: (info) => info.getValue() + ' days',
		enableSorting: false // Usually not sortable
	},

	{
		accessorKey: 'leaveTypeName',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Leave Type',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => info.getValue() ?? 'Not Set'
	},

	{
		accessorKey: 'reason',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Reason',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return info.getValue();
		}
	},

	{
		accessorKey: 'leaveLetter',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Leave Letter',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return renderComponent(DataTableLinks, {
				id: info.getValue(),
				name: info.getValue() ? `Leave Letter ${info.getValue()}` : 'Leave Letter Not Entered',
				link: '/dashboard/files',
				target: '_blank'
			});
		}
	}
];
