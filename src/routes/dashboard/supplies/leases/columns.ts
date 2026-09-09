import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import { leaseStatusBadge } from '$lib/leaseStatus';
import { ethiopianDate, userCell } from '$lib/tableCells';

export const columns = [
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
		accessorKey: 'referenceNumber',
		header: 'Reference',
		cell: (info) => info.getValue() ?? '—'
	},
	{
		accessorKey: 'status',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Status',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) =>
			renderComponent(Statuses, {
				status: leaseStatusBadge(row.original.status)
			})
	},
	{
		accessorKey: 'itemCount',
		header: 'Items',
		cell: (info) => `${info.getValue()} item(s)`
	},
	{
		accessorKey: 'issued',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Issued',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => `${info.getValue()} of ${info.row.original.requested}`
	},
	{
		accessorKey: 'outstanding',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Still Out',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		// Anything still at a site is the number this page exists to surface.
		cell: (info) => (Number(info.getValue()) > 0 ? `${info.getValue()} owed back` : '—')
	},
	{
		accessorKey: 'requestedBy',
		header: 'Requested By',
		cell: ({ row }) => userCell(row.original.requestedById, row.original.requestedBy)
	},
	{
		accessorKey: 'requestedAt',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Requested On',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => ethiopianDate(info.getValue())
	},
	{
		accessorKey: 'expectedReturnDate',
		header: 'Due Back',
		cell: (info) => ethiopianDate(info.getValue())
	}
];
