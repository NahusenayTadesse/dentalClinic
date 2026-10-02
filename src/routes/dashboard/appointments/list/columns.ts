import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { isAppointmentStatus } from '$lib/appointmentStatus';
import type { Messages } from '$lib/i18n/messages';
import { clinicClock, clinicDate, ethiopianClock } from '$lib/clinicTime';
import { formatEthiopianDate } from '$lib/global.svelte';

type Row = PageData['appointments'][number];

const sortable = (name: string) =>
	(({ column }) =>
		renderComponent(DataTableSort, {
			name,
			onclick: column.getToggleSortingHandler()
		})) satisfies ColumnDef<Row>['header'];

/**
 * The appointment list's columns, in the viewer's language. Column ids double as facet keys:
 * `status`, `type`, `provider`, `chair`, `flags` — they stay the same whatever the language, since
 * the server sorts and filters by them. Rebuilt in a `$derived` so a language switch redraws them.
 */
export function listColumns(m: Messages): ColumnDef<Row>[] {
	const l = m.appointments.list;
	return [
		{
			id: 'when',
			header: sortable(l.when),
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: `?date=${clinicDate(row.original.startsAt)}&open=${row.original.id}`,
					name: `${formatEthiopianDate(new Date(row.original.startsAt))} · ${clinicClock(row.original.startsAt)} (${ethiopianClock(row.original.startsAt)})`,
					link: '/dashboard/appointments'
				})
		},
		{
			id: 'patient',
			header: sortable(m.common.patient),
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: row.original.patientId,
					name: row.original.patient,
					entity: 'patient'
				})
		},
		{
			id: 'status',
			header: sortable(m.common.status),
			// The colour comes from the status itself, the words from the viewer's language.
			cell: ({ row }) =>
				renderComponent(Statuses, {
					status: row.original.status,
					label: isAppointmentStatus(row.original.status)
						? m.appointments.status[row.original.status]
						: row.original.status
				})
		},
		{ id: 'type', header: sortable(l.whatFor), cell: ({ row }) => row.original.type ?? '—' },
		{
			id: 'provider',
			header: m.common.dentist,
			cell: ({ row }) => row.original.provider ?? m.common.notAssigned
		},
		{ id: 'chair', header: sortable(m.common.chair), cell: ({ row }) => row.original.chair ?? '—' },
		{
			id: 'minutes',
			header: m.common.minutes,
			cell: ({ row }) => row.original.durationMinutes
		},
		{
			id: 'flags',
			header: l.flags,
			cell: ({ row }) =>
				[row.original.isNewPatient && l.firstVisit, row.original.isAsap && l.shortNotice]
					.filter(Boolean)
					.join(', ') || '—'
		},
		{
			id: 'note',
			header: m.common.note,
			cell: ({ row }) => row.original.cancelReason ?? row.original.note ?? ''
		}
	];
}
