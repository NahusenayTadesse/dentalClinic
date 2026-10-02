import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableActions from './data-table-actions.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Copy from '$lib/Copy.svelte';

export const familyMembers = [
	{
		id: 'index',
		header: '#',
		cell: (info) => {
			const rowIndex = info.table.getRowModel().rows.findIndex((row) => row.id === info.row.id);
			return rowIndex + 1;
		},
		enableSorting: false
	},

	{
		accessorKey: 'product',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Product',
				onclick: column.getToggleSortingHandler()
			})
	},
	{
		// Corresponds to staffId from the query
		accessorKey: 'amount',
		header: 'Amount'
	},
	{
		// Corresponds to date
		accessorKey: 'date',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Date',
				onclick: column.getToggleSortingHandler()
			}),
		// Optional: Custom cell rendering for date formatting
		cell: (info) => {
			// Assuming the date comes in a format that can be parsed by Date
			const date = new Date(info.getValue());
			return date.toLocaleDateString(); // Customize date format as needed
		}
	}
	// You could add an 'actions' column if needed for this table as well.
];

export const commissionService = [
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
		enableSorting: false
	},

	{
		accessorKey: 'service',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Service',
				onclick: column.getToggleSortingHandler()
			})
	},
	{
		// Corresponds to staffId from the query
		accessorKey: 'amount',
		header: 'Amount'
	},
	{
		// Corresponds to date
		accessorKey: 'date',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Date',
				onclick: column.getToggleSortingHandler()
			}),
		// Optional: Custom cell rendering for date formatting
		cell: (info) => {
			// Assuming the date comes in a format that can be parsed by Date
			const date = new Date(info.getValue());
			return date.toLocaleDateString(); // Customize date format as needed
		}
	}
	// You could add an 'actions' column if needed for this table as well.
];

export const overtime = [
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
		enableSorting: false
	},

	{ accessorKey: 'description', header: 'Reason', enableSorting: false },
	{
		// Corresponds to staffId from the query
		accessorKey: 'amount',
		header: 'Amount'
	},
	{
		// Corresponds to date
		accessorKey: 'date',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Date',
				onclick: column.getToggleSortingHandler()
			}),
		// Optional: Custom cell rendering for date formatting
		cell: (info) => {
			// Assuming the date comes in a format that can be parsed by Date
			const date = new Date(info.getValue());
			return date.toLocaleDateString(); // Customize date format as needed
		}
	}
	// You could add an 'actions' column if needed for this table as well.
];

export const deductions = [
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
		enableSorting: false
	},

	{ accessorKey: 'description', header: 'Description', enableSorting: false },

	{
		// Corresponds to staffId from the query
		accessorKey: 'amount',
		header: 'Amount'
	},
	{
		// Corresponds to date
		accessorKey: 'date',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Date',
				onclick: column.getToggleSortingHandler()
			}),
		// Optional: Custom cell rendering for date formatting
		cell: (info) => {
			// Assuming the date comes in a format that can be parsed by Date
			const date = new Date(info.getValue());
			return date.toLocaleDateString(); // Customize date format as needed
		}
	}
	// You could add an 'actions' column if needed for this table as well.
];
