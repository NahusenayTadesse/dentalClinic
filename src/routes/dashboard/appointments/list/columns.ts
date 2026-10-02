import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import { STATUS_LABEL, isAppointmentStatus } from '$lib/appointmentStatus';
import { clinicClock, clinicDate, ethiopianClock } from '$lib/clinicTime';
import { formatEthiopianDate } from '$lib/global.svelte';

type Row = PageData['appointments'][number];

const sortable = (name: string) =>
	(({ column }) =>
		renderComponent(DataTableSort, {
			name,
			onclick: column.getToggleSortingHandler()
		})) satisfies ColumnDef<Row>['header'];

/** Column ids double as facet keys: `status`, `type`, `provider`, `chair`, `flags`. */
export const columns: ColumnDef<Row>[] = [
	{
		id: 'when',
		header: sortable('When'),
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: `?date=${clinicDate(row.original.startsAt)}&open=${row.original.id}`,
				name: `${formatEthiopianDate(new Date(row.original.startsAt))} · ${clinicClock(row.original.startsAt)} (${ethiopianClock(row.original.startsAt)})`,
				link: '/dashboard/appointments'
			})
	},
	{
		id: 'patient',
		header: sortable('Patient'),
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.patientId,
				name: row.original.patient,
				entity: 'patient'
			})
	},
	{
		id: 'status',
		header: sortable('Status'),
		cell: ({ row }) =>
			renderComponent(Statuses, {
				status: isAppointmentStatus(row.original.status)
					? STATUS_LABEL[row.original.status].label
					: row.original.status
			})
	},
	{ id: 'type', header: sortable('For'), cell: ({ row }) => row.original.type ?? '—' },
	{ id: 'provider', header: 'Dentist', cell: ({ row }) => row.original.provider ?? 'Not assigned' },
	{ id: 'chair', header: sortable('Chair'), cell: ({ row }) => row.original.chair ?? '—' },
	{
		id: 'minutes',
		header: 'Minutes',
		cell: ({ row }) => row.original.durationMinutes
	},
	{
		id: 'flags',
		header: 'Flags',
		cell: ({ row }) =>
			[row.original.isNewPatient && 'First visit', row.original.isAsap && 'Short notice']
				.filter(Boolean)
				.join(', ') || '—'
	},
	{
		id: 'note',
		header: 'Note',
		cell: ({ row }) => row.original.cancelReason ?? row.original.note ?? ''
	}
];
