import type { ColumnDef, HeaderContext } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import DeleteEntity from '$lib/components/DeleteEntity.svelte';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import { PROCEDURE_STATUS_LABEL, isProcedureStatus } from '$lib/procedureStatus';
import RowButton from '$lib/components/RowButton.svelte';
import StatusCell from './StatusCell.svelte';
import type { PageData } from './$types';
import { whereLabel } from '$lib/teeth';

/** One row of the procedure table, as the chart tab loads it. */
export type ProcedureRow = PageData['procedures'][number];

function sortable(name: string) {
	return ({ column }: HeaderContext<ProcedureRow, unknown>) =>
		renderComponent(DataTableSort, { name, onclick: column.getToggleSortingHandler() });
}

/**
 * The procedure table. The service name opens the edit dialog for its row — one dialog for the
 * whole table, seeded with the row, rather than a form per row.
 *
 * `status` and `service` hold the words a reader filters by, so the table's facets read "Finding"
 * and "Composite filling" rather than enum values and ids.
 */
export function procedureColumns({
	onedit,
	canEdit
}: {
	onedit: (row: ProcedureRow) => void;
	canEdit: boolean;
}): ColumnDef<ProcedureRow>[] {
	return [
		{
			id: 'date',
			accessorFn: (row) => row.completedOn ?? row.createdAt,
			header: sortable('Date'),
			cell: ({ row }) => {
				const value = row.original.completedOn ?? row.original.createdAt;
				return value ? formatEthiopianDate(new Date(value)) : '';
			}
		},
		{
			id: 'where',
			accessorFn: (row) => whereLabel(row),
			header: 'Tooth'
		},
		{
			id: 'service',
			accessorFn: (row) => row.service ?? 'Retired service',
			header: sortable('Procedure'),
			cell: ({ row, getValue }) =>
				canEdit
					? renderComponent(RowButton, {
							label: String(getValue()),
							onclick: () => onedit(row.original)
						})
					: String(getValue())
		},
		{
			id: 'status',
			accessorFn: (row) =>
				isProcedureStatus(row.status) ? PROCEDURE_STATUS_LABEL[row.status].label : row.status,
			header: sortable('Status'),
			cell: ({ row }) => renderComponent(StatusCell, { status: row.original.status })
		},
		{
			id: 'provider',
			accessorFn: (row) => row.provider ?? '',
			header: 'Dentist'
		},
		{
			id: 'fee',
			accessorFn: (row) => row.fee,
			header: sortable('Fee'),
			cell: ({ row }) => (row.original.fee === null ? '' : formatETB(row.original.fee))
		},
		{
			id: 'delete',
			header: '',
			enableSorting: false,
			cell: ({ row }) =>
				renderComponent(DeleteEntity, {
					entity: 'Procedure',
					name: `${row.original.service ?? 'procedure'} (${whereLabel(row.original)})`,
					id: row.original.id,
					icon: true,
					canDelete: canEdit,
					action: '?/deleteProcedure'
				})
		}
	];
}
