import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableActions from './data-table-actions.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { formatEthiopianDate } from '$lib/global.svelte';
import DeleteEntity from '$lib/components/DeleteEntity.svelte';

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
				name: 'Changed At',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			const n = info.getValue(); // number of days
			return formatEthiopianDate(new Date(n));
		}
	},

	{
		accessorKey: 'quantity',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Changed Quantity',
				onclick: column.getToggleSortingHandler()
			}),

		sortable: true
	},

	{
		accessorKey: 'costPerItem',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Cost Per Item',
				onclick: column.getToggleSortingHandler()
			}),

		sortable: true,
		cell: ({ row }) => {
			return row.original.costPerItem === null
				? 'Removed'
				: `$${row.original.costPerItem.toFixed(2)}`;
		}
	},

	{
		accessorKey: 'changedBy',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Changed By',
				onclick: column.getToggleSortingHandler()
			}),

		sortable: true,
		cell: ({ row }) => {
			return renderComponent(DataTableLinks, {
				id: row.original.extraSettings,
				name: row.original.changedBy,
				link: `/dashboard/users/${row.original.changedById}`,
				target: '_blank'
			});
		}
	},

	{
		accessorKey: 'reciept',
		header: 'Reciept',
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			//
			if (row.original.reciept) {
				return renderComponent(DataTableLinks, {
					id: row.original.extraSettings,
					name: 'View Reciept',
					link: `/dashboard/files/${row.original.reciept}`,
					target: '_blank'
				});
			} else {
				return 'No Reciept';
			}
		}
	},

	// {
	// 	accessorKey: 'action',
	// 	header: 'Actions',
	// 	cell: ({ row }) => {
	// 		// You can pass whatever you need from `row.original` to the component
	// 		return renderComponent(DataTableActions, {
	// 			id: row.original.id,
	// 			recieptLink: row.original.recieptLink,
	// 			date: row.original.date
	// 		});
	// 	}
	// }

	{
		id: 'delete',
		header: '',
		enableSorting: false,
		// Renders nothing unless `canDelete`; the action re-checks on the server.
		cell: ({ row }) =>
			renderComponent(DeleteEntity, {
				entity: 'Adjustment',
				name: row.original?.reason,
				id: row.original?.id,
				icon: true,
				canDelete
			})
	}
];
