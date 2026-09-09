import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableActions from './data-table-actions.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { Row } from '$lib/components/ui/table';

export const columns = [
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
		accessorKey: 'name',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Name',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.name,
				link: '/dashboard/supplies'
			});
		}
	},

	{
		accessorKey: 'type',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Type',
				onclick: column.getToggleSortingHandler()
			}),

		sortable: true
	},

	{
		accessorKey: 'onHand',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'In Store',
				onclick: column.getToggleSortingHandler()
			}),

		sortable: true,
		cell: (info) => `${info.getValue()} ${info.row.original.unitOfMeasure ?? ''}`.trim()
	},

	{
		accessorKey: 'available',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Free to Lease',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		// In store minus whatever an approved lease has already claimed. Flagged
		// when it has fallen to the reorder level.
		cell: ({ row }) =>
			row.original.belowReorder
				? `${row.original.available} — reorder`
				: String(row.original.available)
	},

	{
		accessorKey: 'reserved',
		header: 'Reserved',
		cell: (info) => (Number(info.getValue()) > 0 ? info.getValue() : '—')
	},

	{
		accessorKey: 'leasedOut',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Out at Sites',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => (Number(info.getValue()) > 0 ? info.getValue() : '—')
	},

	{
		accessorKey: 'totalOwned',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Total Owned',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},

	{
		accessorKey: 'kind',
		header: 'Kind'
	},

	{
		accessorKey: 'description',
		header: 'Description'
	},

	{
		accessorKey: 'actions',
		header: 'Actions',
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableActions, { id: row.original.id, name: row.original.name });
		}
	}
];
