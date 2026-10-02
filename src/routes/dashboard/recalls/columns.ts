import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Copy from '$lib/Copy.svelte';
import { ethiopianDate } from '$lib/tableCells';
import RecallActions from './RecallActions.svelte';
import type { PageData } from './$types';

/** One recall on the list. */
type Row = PageData['recalls'][number];

/**
 * The recall list. The patient opens their chart (for someone who may, CLAUDE.md §12); the calls
 * column is what stops a patient being rung a fourth time.
 */
export function recallColumns(oncall: (row: Row) => void, maxAttempts: number): ColumnDef<Row>[] {
	return [
		{
			id: 'patient',
			header: 'Patient',
			accessorFn: (row) => row.patient,
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					entity: 'patient',
					id: row.original.patientId,
					name: row.original.patient
				})
		},
		{
			accessorKey: 'phone',
			header: 'Phone',
			cell: ({ row }) => renderComponent(Copy, { data: row.original.phone })
		},
		{
			id: 'visit',
			header: 'For',
			accessorFn: (row) => row.visit ?? 'A visit'
		},
		{
			id: 'dueOn',
			header: 'Due',
			accessorFn: (row) => row.dueOn,
			cell: ({ row }) =>
				`${ethiopianDate(row.original.dueOn)}${row.original.overdue ? ' · overdue' : ''}`
		},
		{
			id: 'lastVisitOn',
			header: 'Last visit',
			accessorFn: (row) => row.lastVisitOn,
			cell: ({ row }) => ethiopianDate(row.original.lastVisitOn)
		},
		{
			id: 'calls',
			header: 'Calls',
			accessorFn: (row) =>
				row.attempts === 0 ? 'Not rung yet' : row.attempts >= maxAttempts ? 'Tried enough' : 'Rung',
			cell: ({ row }) =>
				row.original.attempts === 0
					? '—'
					: `${row.original.attempts}× · last ${ethiopianDate(row.original.lastContactedOn)}`
		},
		{ accessorKey: 'note', header: 'Note', cell: ({ row }) => row.original.note ?? '' },
		{
			id: 'actions',
			header: '',
			cell: ({ row }) =>
				renderComponent(RecallActions, {
					patientId: row.original.patientId,
					appointmentTypeId: row.original.appointmentTypeId,
					oncall: () => oncall(row.original)
				})
		}
	];
}
