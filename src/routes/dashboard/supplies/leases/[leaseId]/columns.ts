import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import { leaseStatusBadge, leaseStatusLabel } from '$lib/leaseStatus';
import { ethiopianDateTime, userCell } from '$lib/tableCells';

/** Every physical hand-over on this lease. */
export const movementColumns = [
	{
		id: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
		enableSorting: false
	},
	{
		accessorKey: 'performedAt',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'When',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => ethiopianDateTime(info.getValue())
	},
	{
		accessorKey: 'item',
		header: 'Item'
	},
	{
		accessorKey: 'movementType',
		header: 'Movement',
		cell: (info) => {
			const labels = { issue: 'Issued out', return: 'Returned', write_off: 'Written off' };
			return labels[info.getValue() as keyof typeof labels] ?? info.getValue();
		}
	},
	{
		accessorKey: 'quantity',
		header: 'Quantity',
		// Direction lives in the movement type, so the sign is shown here instead
		// of stored on the row.
		cell: (info) => (info.row.original.movementType === 'issue' ? '−' : '+') + info.getValue()
	},
	{
		accessorKey: 'condition',
		header: 'Condition',
		cell: (info) => info.getValue() ?? '—'
	},
	{
		accessorKey: 'performedBy',
		header: 'By',
		cell: ({ row }) => userCell(row.original.performedById, row.original.performedBy)
	},
	{
		accessorKey: 'reason',
		header: 'Note',
		cell: (info) => info.getValue() ?? '—'
	}
];

/** The append-only status log. */
export const eventColumns = [
	{
		id: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
		enableSorting: false
	},
	{
		accessorKey: 'actedAt',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'When',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => ethiopianDateTime(info.getValue())
	},
	{
		accessorKey: 'fromStatus',
		header: 'From',
		cell: (info) => (info.getValue() ? leaseStatusLabel(info.getValue() as string) : 'Created')
	},
	{
		accessorKey: 'toStatus',
		header: 'To',
		cell: ({ row }) =>
			renderComponent(Statuses, { status: leaseStatusBadge(row.original.toStatus) })
	},
	{
		accessorKey: 'actedBy',
		header: 'By',
		cell: ({ row }) => userCell(row.original.actedById, row.original.actedBy)
	},
	{
		accessorKey: 'note',
		header: 'Note',
		cell: (info) => info.getValue() ?? '—'
	}
];
