import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import Copy from '@nahu/admin-kit/Copy.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { isAppointmentStatus } from '$lib/appointmentStatus';
import type { Messages } from '$lib/i18n/messages';
import { clinicClock, clinicDate, ethiopianClock } from '$lib/clinicTime';
import { formatEthiopianDate } from '$lib/global.svelte';
import ReminderAction from './ReminderAction.svelte';
import SmsTextButton from '$lib/components/SmsTextButton.svelte';
import type { PageData } from './$types';

/** One appointment on the reminder list. */
type Row = PageData['rows'][number];

/** When a reminder last went out: the time if it was today, the day if earlier. */
function remindedWhen(m: Messages, at: Date | string | null): string {
	const r = m.appointments.reminders;
	if (!at) return r.notYet;
	const day = clinicDate(at);
	return day === clinicDate(new Date())
		? r.todayAt(clinicClock(at))
		: formatEthiopianDate(new Date(at));
}

/**
 * The reminder list. The time opens the appointment in the day view; the patient opens their chart
 * for someone who may (CLAUDE.md §12). The `reminded` column doubles as a facet, so the desk can
 * narrow to who is left to ring. In the viewer's language; rebuilt in a `$derived` on a switch.
 */
export function reminderColumns(
	m: Messages,
	onremind: ((row: Row) => void) | null,
	/** Whether the Text button may send: a gateway is set up and the viewer may remind. */
	canText = false
): ColumnDef<Row>[] {
	const r = m.appointments.reminders;
	const columns: ColumnDef<Row>[] = [
		{
			id: 'time',
			header: m.common.time,
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
		{ id: 'type', header: m.common.what, accessorFn: (row) => row.type ?? m.common.aVisit },
		{
			id: 'provider',
			header: m.common.dentist,
			accessorFn: (row) => row.provider ?? m.common.notAssigned
		},
		{
			id: 'status',
			header: m.common.status,
			accessorFn: (row) =>
				isAppointmentStatus(row.status) ? m.appointments.status[row.status] : row.status,
			// The colour from the status, the words in the viewer's language.
			cell: ({ row, getValue }) =>
				renderComponent(Statuses, { status: row.original.status, label: String(getValue()) })
		},
		{
			id: 'reminded',
			header: r.reminded,
			accessorFn: (row) => (row.reminderSentAt ? r.reminded : r.notReminded),
			cell: ({ row }) => remindedWhen(m, row.original.reminderSentAt)
		}
	];
	columns.push({
		id: 'sms',
		header: m.common.sms.column,
		enableSorting: false,
		cell: ({ row }) =>
			renderComponent(SmsTextButton, {
				action: '?/textReminder',
				field: 'appointmentId',
				id: row.original.id,
				status: row.original.sms.state,
				textedAt: row.original.sms.at,
				canSend: canText
			})
	});
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
