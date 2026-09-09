import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import { leaseStatusBadge } from '$lib/leaseStatus';
import { ethiopianDate, userCell } from '$lib/tableCells';

/** Where this supply item has gone, and what is still owed back. */
export const leaseColumns = [
	{
		id: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
		enableSorting: false
	},
	{
		accessorKey: 'site',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Site',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.site ?? 'Unknown site',
				link: '/dashboard/supplies/leases'
			})
	},
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ row }) => renderComponent(Statuses, { status: leaseStatusBadge(row.original.status) })
	},
	{
		accessorKey: 'issued',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Issued',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},
	{
		accessorKey: 'returned',
		header: 'Returned'
	},
	{
		accessorKey: 'writtenOff',
		header: 'Written Off',
		cell: (info) => (Number(info.getValue()) > 0 ? info.getValue() : '—')
	},
	{
		accessorKey: 'outstanding',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Still Out',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => (Number(info.getValue()) > 0 ? `${info.getValue()} owed back` : '—')
	},
	{
		accessorKey: 'expectedReturnDate',
		header: 'Due Back',
		cell: (info) => ethiopianDate(info.getValue())
	},
	{
		accessorKey: 'requestedBy',
		header: 'Requested By',
		cell: ({ row }) => userCell(row.original.requestedById, row.original.requestedBy)
	}
];
