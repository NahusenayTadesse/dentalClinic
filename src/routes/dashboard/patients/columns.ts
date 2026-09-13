import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';
import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Copy from '$lib/Copy.svelte';
import { formatEthiopianDate } from '$lib/global.svelte';
import NameCell from './name-cell.svelte';
import AlertsCell from './alerts-cell.svelte';
import HistoryCell from './history-cell.svelte';

/** One row of the patient list, taken from the load so the two cannot drift. */
type Row = PageData['patients'][number];

const sortable = (name: string) =>
	(({ column }) =>
		renderComponent(DataTableSort, {
			name,
			onclick: column.getToggleSortingHandler()
		})) satisfies ColumnDef<Row>['header'];

/**
 * The patient list's columns.
 *
 * Column ids are also facet keys — `sex`, `age`, `allergies` — which is what puts each filter in
 * its own header. The URL param each writes is mapped in `+page.svelte`.
 */
export const columns: ColumnDef<Row>[] = [
	{
		id: 'name',
		accessorKey: 'name',
		header: sortable('Patient'),
		cell: ({ row }) =>
			renderComponent(NameCell, {
				id: row.original.id,
				name: row.original.name,
				fileNo: row.original.fileNo,
				fromOtherBranch: row.original.fromOtherBranch,
				branch: row.original.branch
			})
	},
	{
		id: 'sex',
		accessorKey: 'sex',
		header: 'Sex',
		cell: ({ row }) => (row.original.sex === 'female' ? 'Female' : 'Male')
	},
	{
		id: 'age',
		accessorKey: 'age',
		header: sortable('Age'),
		// "~" when the year is a guess: many adults here do not know their date of birth, and a
		// dosing decision for a child should know the difference.
		cell: ({ row }) =>
			row.original.age === null ? '—' : `${row.original.ageEstimated ? '~' : ''}${row.original.age}`
	},
	{
		id: 'phone',
		accessorKey: 'phone',
		header: 'Phone',
		cell: ({ row }) =>
			row.original.phone ? renderComponent(Copy, { data: row.original.phone }) : '—'
	},
	{
		id: 'alerts',
		header: 'Alerts',
		enableSorting: false,
		cell: ({ row }) =>
			renderComponent(AlertsCell, {
				allergies: row.original.allergies,
				medicineAlerts: row.original.medicineAlerts
			})
	},
	{
		// Faceted by allergen; the cell lists every recorded allergy by name.
		id: 'allergies',
		header: 'Allergies',
		enableSorting: false,
		cell: ({ row }) => row.original.allergies.map((a) => a.name).join(', ') || '—'
	},
	{
		id: 'conditions',
		header: 'Conditions',
		enableSorting: false,
		cell: ({ row }) => row.original.conditions.join(', ') || '—'
	},
	{
		id: 'bloodType',
		accessorKey: 'bloodType',
		header: 'Blood',
		cell: ({ row }) => row.original.bloodType ?? '—'
	},
	{
		id: 'history',
		accessorKey: 'historyTakenAt',
		header: sortable('History'),
		cell: ({ row }) =>
			renderComponent(HistoryCell, {
				state: row.original.history,
				takenAt: row.original.historyTakenAt
			})
	},
	{
		id: 'referral',
		accessorKey: 'referral',
		header: sortable('Heard of us'),
		cell: ({ row }) => row.original.referral ?? '—'
	},
	{
		id: 'payer',
		accessorKey: 'payer',
		header: sortable('Pays'),
		cell: ({ row }) => row.original.payer ?? 'At the desk'
	},
	{
		id: 'registered',
		accessorKey: 'registered',
		header: sortable('Registered'),
		cell: ({ row }) =>
			row.original.registered ? formatEthiopianDate(new Date(row.original.registered)) : '—'
	}
];
