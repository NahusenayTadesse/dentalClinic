import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DeleteEntity from '$lib/components/DeleteEntity.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableActions from './data-table-actions.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { formatEthiopianDate } from '$lib/global.svelte';

/**
 * Built per request rather than exported as a constant: the delete column
 * needs to know whether the viewer is a super admin, which only the page has.
 */
export const makeColumns = (canDelete = false) => [
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => info.row.index + 1
	},

	{
		accessorKey: 'date',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Paid At',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			return renderComponent(DataTableLinks, {
				id: row.original.id,
				name: formatEthiopianDate(new Date(row.original.date)),
				link: '/dashboard/transactions/single'
			});
		}
	},

	{
		accessorKey: 'expenseType',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Expense Type',
				onclick: column.getToggleSortingHandler()
			}),

		sortable: true
	},

	{
		accessorKey: 'amount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Amount',
				onclick: column.getToggleSortingHandler()
			}),

		sortable: true
	},

	{
		accessorKey: 'paymentMethods',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Payment Method',
				onclick: column.getToggleSortingHandler()
			}),

		sortable: true
	},

	{
		accessorKey: 'recievedBy',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Recieved By',
				onclick: column.getToggleSortingHandler()
			}),

		sortable: true,
		cell: ({ row }) => {
			return renderComponent(DataTableLinks, {
				id: row.original.recievedById,
				name: row.original.recievedBy,
				link: '/dashboard/users'
			});
		}
	},

	// {
	// 	accessorKey: 'noOfProducts',
	// 	header: ({ column }) =>
	// 		renderComponent(DataTableSort, {
	// 			name: 'No. of Products',
	// 			onclick: column.getToggleSortingHandler()
	// 		}),

	// 	sortable: true
	// },

	// {
	// 	accessorKey: 'noOfServices',
	// 	header: ({ column }) =>
	// 		renderComponent(DataTableSort, {
	// 			name: 'No. of Services',
	// 			onclick: column.getToggleSortingHandler()
	// 		}),

	// 	sortable: true
	// },

	// {
	// 	accessorKey: 'noOfSupplies',
	// 	header: ({ column }) =>
	// 		renderComponent(DataTableSort, {
	// 			name: 'No. of Supplies',
	// 			onclick: column.getToggleSortingHandler()
	// 		}),

	// 	sortable: true
	// },

	{
		accessorKey: 'recieptLink',
		header: 'Reciept',
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.extraSettings,
				name: 'View Reciept',
				link: `/dashboard/files/${row.original.recieptLink}`,
				target: '_blank'
			});
		}
	},

	// {
	// 	accessorKey: 'action',
	// 	header: 'Actions',
	// 	cell: ({ row }) => {
	// 		// You can pass whatever you need from `row.original` to the component
	// 		return renderComponent(DataTableActions, {
	// 			id: row.original.id,
	// 			booker: row.original.recievedById,
	// 			recieptLink: row.original.recieptLink,
	// 			date: row.original.date
	// 		});
	// 	}
	// },

	{
		id: 'delete',
		header: '',
		enableSorting: false,
		// Renders nothing unless `canDelete`; the action re-checks on the server.
		cell: ({ row }) =>
			renderComponent(DeleteEntity, {
				entity: 'Expense',
				name: row.original?.expenseType,
				id: row.original?.expenseId,
				icon: true,
				canDelete
			})
	}
];
