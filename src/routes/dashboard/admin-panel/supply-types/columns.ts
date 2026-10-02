import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import RowButton from '@nahu/admin-kit/components/RowButton.svelte';
import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
import type { PageData } from './$types';

export type Row = PageData['allData'][number];

/**
 * The supply types table. The item count is what makes it useful: it says which types are in use,
 * and the delete action refuses those.
 */
export function makeColumns(onedit: (row: Row) => void, canDelete: boolean): ColumnDef<Row>[] {
	return [
		{
			accessorKey: 'name',
			header: 'Name',
			cell: ({ row }) =>
				renderComponent(RowButton, {
					label: row.original.name,
					onclick: () => onedit(row.original)
				})
		},
		{
			accessorKey: 'description',
			header: 'Description',
			cell: ({ row }) => row.original.description ?? '—'
		},
		{
			accessorKey: 'supplyCount',
			header: 'Items',
			cell: ({ row }) =>
				Number(row.original.supplyCount) === 0 ? 'None' : `${row.original.supplyCount} item(s)`
		},
		{ accessorKey: 'totalStock', header: 'Units in store', meta: { align: 'right' } },
		{
			id: 'delete',
			header: '',
			enableSorting: false,
			// Renders nothing unless the viewer is a super admin; the action re-checks, and refuses
			// any type that still has supplies under it.
			cell: ({ row }) =>
				renderComponent(DeleteEntity, {
					entity: 'Supply Type',
					name: row.original.name,
					id: row.original.id,
					consequence:
						Number(row.original.supplyCount) > 0
							? `${row.original.supplyCount} supply item(s) still use this type — the delete will be refused until they are moved.`
							: 'Nothing uses this type.',
					icon: true,
					canDelete
				})
		}
	];
}
