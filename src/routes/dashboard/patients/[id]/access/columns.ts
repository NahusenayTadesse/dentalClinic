import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { VIEWED_RECORD_LABEL, VIEW_ACTION_LABEL } from '$lib/accessLog';
import { ethiopianDateTime } from '$lib/tableCells';
import type { PageData } from './$types';

/** One opening of the chart. */
type Row = PageData['views'][number];

/**
 * The access log's columns. The person links to their account (for someone who may open it,
 * CLAUDE.md §12); "part" is which tab, so "who read the notes" is one facet away.
 */
export function accessColumns(): ColumnDef<Row>[] {
	return [
		{
			id: 'viewedAt',
			header: 'When',
			accessorFn: (row) => row.viewedAt,
			cell: ({ row }) => ethiopianDateTime(row.original.viewedAt)
		},
		{
			id: 'user',
			header: 'Who',
			accessorFn: (row) => row.user ?? 'Deleted user',
			cell: ({ row }) =>
				row.original.userId
					? renderComponent(DataTableLinks, {
							entity: 'user',
							id: row.original.userId,
							name: row.original.user ?? 'Deleted user'
						})
					: 'Deleted user'
		},
		{
			id: 'action',
			header: 'Did',
			accessorFn: (row) => VIEW_ACTION_LABEL[row.action] ?? row.action
		},
		{
			id: 'part',
			header: 'Part of the chart',
			accessorFn: (row) => VIEWED_RECORD_LABEL[row.recordType] ?? row.recordType
		},
		{ id: 'branch', header: 'Branch', accessorFn: (row) => row.branch ?? '—' },
		{ id: 'ipAddress', header: 'From address', accessorFn: (row) => row.ipAddress ?? '—' }
	];
}
