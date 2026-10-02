import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { addClinicDays } from '$lib/clinicTime';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import { APPLIANCE_LABEL, ORTHO_STATUS_LABEL } from '$lib/orthoPlan';
import type { PageData } from './$types';

/** One case on the board, as the page loads it. */
type BoardRow = PageData['cases'][number];

/** When the patient is due back: the last visit and the weeks it said, or nothing to go on. */
const backOn = (row: BoardRow) =>
	row.lastVisit?.nextInWeeks
		? addClinicDays(row.lastVisit.visitedOn, row.lastVisit.nextInWeeks * 7)
		: null;

/**
 * The board: the patient opens their case. `money` holds the words a receptionist filters by —
 * "Due to bill", "Overdue" — so the facet is a worklist.
 */
export const boardColumns: ColumnDef<BoardRow>[] = [
	{
		id: 'patient',
		header: 'Patient',
		accessorFn: (row) => row.patient,
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.patient,
				// The case itself: `link` + `id`, since a case is not one of `entityLinks`' kinds.
				link: `/dashboard/patients/${row.original.patientId}/ortho`
			})
	},
	{ id: 'fileNo', header: 'File', accessorFn: (row) => row.fileNo ?? '—' },
	{ id: 'phone', header: 'Phone', accessorFn: (row) => row.phone ?? '—' },
	{ id: 'appliance', header: 'Appliance', accessorFn: (row) => APPLIANCE_LABEL[row.appliance] },
	{ id: 'status', header: 'Stage', accessorFn: (row) => ORTHO_STATUS_LABEL[row.status] },
	{
		id: 'month',
		header: 'Month',
		accessorFn: (row) => `${row.progress.months} of ${row.plannedMonths}`
	},
	{
		id: 'backOn',
		header: 'Due back',
		accessorFn: (row) => {
			const on = backOn(row);
			return on ? ethiopianDate(on) : '—';
		}
	},
	{
		id: 'money',
		header: 'Payments',
		accessorFn: (row) =>
			row.overdue ? 'Overdue' : row.dueUnbilled ? 'Due to bill' : row.owed ? 'Billed' : 'Up to date'
	},
	{ id: 'owed', header: 'Billed, unpaid', accessorFn: (row) => formatETB(row.owed) }
];
