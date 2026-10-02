import type { ColumnDef } from '@tanstack/table-core';
import type { SuperValidated } from 'sveltekit-superforms';
import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { LedgerMeta } from '$lib/payrollLedger';
import RowActions from './RowActions.svelte';
import type { PageData } from './$types';

/** One adjustment, as the load returns it. */
type Row = PageData['rows'][number];

/**
 * A ledger's columns. The kind decides two of them — the type, and the hours for overtime — so one
 * set serves all three. Ids match the facet keys and the sort keys, which is what puts each
 * filter in its own header and each sort on the server (`LEDGER_SORTS`).
 */
export function ledgerColumns(
	meta: LedgerMeta,
	onedit: (row: Row) => void,
	remove: SuperValidated<Record<string, unknown>> | null
): ColumnDef<Row>[] {
	const columns: ColumnDef<Row>[] = [
		{
			id: 'date',
			header: 'Date',
			accessorFn: (row) => row.date,
			cell: ({ row }) => ethiopianDate(row.original.date)
		},
		{
			id: 'employee',
			header: 'Employee',
			accessorFn: (row) => row.employee,
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					entity: 'employee',
					id: row.original.staffId,
					name: row.original.employee
				})
		},
		{ id: 'department', header: 'Department', accessorFn: (row) => row.department ?? '—' },
		{ id: 'position', header: 'Position', accessorFn: (row) => row.position ?? '—' }
	];
	if (meta.typeLabel) {
		columns.push({ id: 'type', header: meta.typeLabel, accessorFn: (row) => row.type ?? '—' });
	}
	if (meta.priced === 'hours') {
		columns.push({ id: 'hours', header: 'Hours', accessorFn: (row) => row.hours ?? 0 });
	}
	columns.push(
		{
			id: 'amount',
			header: meta.effect === 'takes' ? 'Taken' : 'Paid',
			accessorFn: (row) => row.amount,
			cell: ({ row }) => formatETB(row.original.amount)
		},
		{ id: 'reason', header: 'Reason', accessorFn: (row) => row.reason ?? '' },
		{
			id: 'paid',
			header: 'Payroll',
			accessorFn: (row) => (row.paid ? 'Paid' : 'Not paid yet')
		},
		{ id: 'recordedBy', header: 'Recorded by', accessorFn: (row) => row.recordedBy ?? '—' },
		{
			id: 'actions',
			header: '',
			cell: ({ row }) =>
				renderComponent(RowActions, {
					id: row.original.id,
					paid: row.original.paid,
					onedit: () => onedit(row.original),
					remove
				})
		}
	);
	return columns;
}
