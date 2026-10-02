import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableActions from './data-table-actions.svelte';
import { STOCK_STATUSES, SUPPLY_KINDS, UNSPECIFIED_UNIT } from './filters';
import type { PageData } from './$types';

/** One supply, as the load returns it. */
type Row = PageData['supplyList'][number];

const nameOf = (options: { value: string; name: string }[], value: string) =>
	options.find((o) => o.value === value)?.name ?? value;

/**
 * The supplies columns. Ids match the facet keys in the load, which is what puts each filter —
 * type, kind, unit, stock — in its own header.
 */
export const columns: ColumnDef<Row>[] = [
	{
		id: 'name',
		header: 'Name',
		accessorFn: (row) => row.name,
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				entity: 'supply',
				id: row.original.id,
				name: row.original.name
			})
	},
	{ id: 'type', header: 'Type', accessorFn: (row) => row.type ?? '—' },
	{
		id: 'onHand',
		header: 'In store',
		accessorFn: (row) => row.onHand,
		cell: ({ row }) =>
			`${row.original.onHand} ${row.original.unitOfMeasure === UNSPECIFIED_UNIT ? '' : row.original.unitOfMeasure}`.trim(),
		meta: { align: 'right' }
	},
	{
		id: 'stockStatus',
		header: 'Stock',
		accessorFn: (row) => nameOf(STOCK_STATUSES, row.stockStatus)
	},
	{
		id: 'unitOfMeasure',
		header: 'Unit',
		accessorFn: (row) => (row.unitOfMeasure === UNSPECIFIED_UNIT ? '—' : row.unitOfMeasure)
	},
	{ id: 'kind', header: 'Kind', accessorFn: (row) => nameOf(SUPPLY_KINDS, row.kind) },
	{ id: 'description', header: 'Description', accessorFn: (row) => row.description ?? '' },
	{
		id: 'actions',
		header: '',
		cell: ({ row }) =>
			renderComponent(DataTableActions, { id: row.original.id, name: row.original.name })
	}
];
