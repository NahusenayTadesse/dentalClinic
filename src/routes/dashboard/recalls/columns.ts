import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Copy from '@nahu/admin-kit/Copy.svelte';
import { ethiopianDate } from '$lib/tableCells';
import RecallActions from './RecallActions.svelte';
import type { Messages } from '$lib/i18n/messages';
import type { PageData } from './$types';

/** One recall on the list. */
type Row = PageData['recalls'][number];

/**
 * The recall list. The patient opens their chart (for someone who may, CLAUDE.md §12); the calls
 * column is what stops a patient being rung a fourth time. In the viewer's language; rebuilt in a
 * `$derived` on a switch.
 */
export function recallColumns(
	m: Messages,
	oncall: (row: Row) => void,
	maxAttempts: number
): ColumnDef<Row>[] {
	const r = m.appointments.recalls;
	return [
		{
			id: 'patient',
			header: m.common.patient,
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
			header: m.common.phone,
			cell: ({ row }) => renderComponent(Copy, { data: row.original.phone })
		},
		{
			id: 'visit',
			header: m.common.what,
			accessorFn: (row) => row.visit ?? m.common.aVisit
		},
		{
			id: 'dueOn',
			header: r.due,
			accessorFn: (row) => row.dueOn,
			cell: ({ row }) =>
				`${ethiopianDate(row.original.dueOn)}${row.original.overdue ? r.overdueSuffix : ''}`
		},
		{
			id: 'lastVisitOn',
			header: r.lastVisit,
			accessorFn: (row) => row.lastVisitOn,
			cell: ({ row }) => ethiopianDate(row.original.lastVisitOn)
		},
		{
			id: 'calls',
			header: r.calls,
			accessorFn: (row) =>
				row.attempts === 0 ? r.notRungYet : row.attempts >= maxAttempts ? r.triedEnough : r.rung,
			cell: ({ row }) =>
				row.original.attempts === 0
					? '—'
					: r.callsCell(row.original.attempts, ethiopianDate(row.original.lastContactedOn))
		},
		{ accessorKey: 'note', header: m.common.note, cell: ({ row }) => row.original.note ?? '' },
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
