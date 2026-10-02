import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { PageData } from './$types';

/** One expense, as the load returns it. */
type Row = PageData['rows'][number];

/**
 * The expenses columns. Ids match the facet and sort keys in the load. Built per request rather
 * than exported as a constant: the delete column needs to know whether the viewer is a super
 * admin, which only the page has — and the action re-checks.
 */
export const makeColumns = (canDelete = false): ColumnDef<Row>[] => [
	{
		id: 'date',
		header: 'Date',
		accessorFn: (row) => row.date,
		cell: ({ row }) => ethiopianDate(row.original.date)
	},
	{ id: 'expenseType', header: 'Category', accessorFn: (row) => row.expenseType ?? '—' },
	{ id: 'description', header: 'Description', accessorFn: (row) => row.description ?? '' },
	{ id: 'payee', header: 'Paid to', accessorFn: (row) => row.payee ?? '—' },
	{
		id: 'amount',
		header: 'Amount',
		accessorFn: (row) => row.amount,
		cell: ({ row }) => formatETB(row.original.amount),
		meta: { align: 'right' }
	},
	{ id: 'paymentMethod', header: 'Paid from', accessorFn: (row) => row.paymentMethod ?? '—' },
	{
		id: 'recievedBy',
		header: 'Recorded by',
		accessorFn: (row) => row.recievedBy ?? '',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.recievedById,
				name: row.original.recievedBy,
				entity: 'user'
			})
	},
	{
		id: 'recieptLink',
		header: 'Receipt',
		cell: ({ row }) =>
			row.original.recieptLink
				? renderComponent(DataTableLinks, {
						id: row.original.recieptLink,
						name: 'View',
						link: '/dashboard/files',
						target: '_blank'
					})
				: '—'
	},
	{
		id: 'delete',
		header: '',
		enableSorting: false,
		// Renders nothing unless `canDelete`; the action re-checks on the server.
		cell: ({ row }) =>
			renderComponent(DeleteEntity, {
				entity: 'Expense',
				name: row.original.expenseType ?? 'expense',
				id: row.original.expenseId ?? undefined,
				icon: true,
				canDelete
			})
	}
];
