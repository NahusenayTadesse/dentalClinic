import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import Copy from '@nahu/admin-kit/Copy.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { STATUS_LABEL, isAppointmentStatus } from '$lib/appointmentStatus';
import { clinicClock, clinicDate, ethiopianClock } from '$lib/clinicTime';
import { formatEthiopianDate } from '$lib/global.svelte';
import ReminderAction from './ReminderAction.svelte';
import type { PageData } from './$types';

/** One appointment on the reminder list. */
type Row = PageData['rows'][number];

/** When a reminder last went out: the time if it was today, the day if earlier. */
function remindedWhen(at: Date | string | null): string {
	if (!at) return 'Not yet';
	const day = clinicDate(at);
	return day === clinicDate(new Date())
		? `Today, ${clinicClock(at)}`
		: formatEthiopianDate(new Date(at));
}

/**
 * The reminder list. The time opens the appointment in the day view; the patient opens their chart
 * for someone who may (CLAUDE.md §12). The `reminded` column doubles as a facet, so the desk can
 * narrow to who is left to ring.
 */
export function reminderColumns(onremind: ((row: Row) => void) | null): ColumnDef<Row>[] {
	const columns: ColumnDef<Row>[] = [
		{
			id: 'time',
			header: 'Time',
			accessorFn: (row) => clinicClock(row.startsAt),
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: `?date=${clinicDate(row.original.startsAt)}&open=${row.original.id}`,
					name: `${clinicClock(row.original.startsAt)} (${ethiopianClock(row.original.startsAt)})`,
					link: '/dashboard/appointments'
				})
		},
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
		{ id: 'type', header: 'For', accessorFn: (row) => row.type ?? 'A visit' },
		{ id: 'provider', header: 'Dentist', accessorFn: (row) => row.provider ?? 'Not assigned' },
		{
			id: 'status',
			header: 'Status',
			accessorFn: (row) =>
				isAppointmentStatus(row.status) ? STATUS_LABEL[row.status].label : row.status,
			cell: ({ getValue }) => renderComponent(Statuses, { status: String(getValue()) })
		},
		{
			id: 'reminded',
			header: 'Reminded',
			accessorFn: (row) => (row.reminderSentAt ? 'Reminded' : 'Not reminded'),
			cell: ({ row }) => remindedWhen(row.original.reminderSentAt)
		}
	];
	if (onremind) {
		columns.push({
			id: 'actions',
			header: '',
			enableSorting: false,
			cell: ({ row }) =>
				renderComponent(ReminderAction, {
					reminded: row.original.reminderSentAt !== null,
					onremind: () => onremind(row.original)
				})
		});
	}
	return columns;
}
