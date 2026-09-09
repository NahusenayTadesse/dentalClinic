import { renderComponent } from '$lib/components/ui/data-table/index.js';

import DataTableSort from '$lib/components/Table/data-table-sort.svelte';

export const columns = [
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
		enableSorting: false
	},

	{
		accessorKey: 'bookedAppointments',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Booked Appointments',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => row.original.bookedAppointments
	},

	{
		accessorKey: 'productsSold',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Products Sold',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => row.original.productsSold
	},

	{
		accessorKey: 'serviceRendered',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Service Rendered',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => row.original.serviceRendered
	},

	{
		accessorKey: 'dailyExpenses',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Daily Expenses',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => row.original.dailyExpenses
	},

	{
		accessorKey: 'dailyIncome',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Daily Income',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => row.original.dailyIncome
	},

	{
		accessorKey: 'transactions',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Transactions',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => row.original.transactions
	}
];
