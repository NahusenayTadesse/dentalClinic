import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import Copy from '$lib/Copy.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
export const columns = [
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
		enableSorting: false
	},
	{
		accessorKey: 'type',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Contract Type',
				onclick: column.getToggleSortingHandler()
			})
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
		accessorKey: 'year',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Email',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'addedBy',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Added By',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) => {
			return renderComponent(Statuses, {
				status: row.original.status ? 'Active' : 'Inactive'
			});
		}
	}
];
