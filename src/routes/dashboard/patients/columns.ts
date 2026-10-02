import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
import Copy from '@nahu/admin-kit/Copy.svelte';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import NameCell from './name-cell.svelte';
import AlertsCell from './alerts-cell.svelte';
import HistoryCell from './history-cell.svelte';
import type { Messages } from '$lib/i18n/messages';

/** One row of the patient list, taken from the load so the two cannot drift. */
type Row = PageData['patients'][number];

const sortable = (name: string) =>
	(({ column }) =>
		renderComponent(DataTableSort, {
			name,
			onclick: column.getToggleSortingHandler()
		})) satisfies ColumnDef<Row>['header'];

/**
 * The patient list's columns, in the viewer's language — built in a `$derived` on the page, so a
 * language switch rebuilds them.
 *
 * Column ids are also facet keys — `sex`, `age`, `allergies` — which is what puts each filter in
 * its own header. The URL param each writes is mapped in `+page.svelte`. `withOwes` adds what each
 * patient owes, for someone who may see billing — the load leaves `owes` null for everyone else.
 */
export function patientColumns(m: Messages, withOwes: boolean): ColumnDef<Row>[] {
	const c = m.patients.list.columns;
	const columns: ColumnDef<Row>[] = [
		{
			id: 'name',
			accessorKey: 'name',
			header: sortable(c.patient),
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
			header: c.sex,
			cell: ({ row }) => m.patients.sex[row.original.sex]
		},
		{
			id: 'age',
			accessorKey: 'age',
			header: sortable(c.age),
			// "~" when the year is a guess: many adults here do not know their date of birth, and a
			// dosing decision for a child should know the difference.
			cell: ({ row }) =>
				row.original.age === null
					? '—'
					: `${row.original.ageEstimated ? '~' : ''}${row.original.age}`
		},
		{
			id: 'phone',
			accessorKey: 'phone',
			header: c.phone,
			cell: ({ row }) =>
				row.original.phone ? renderComponent(Copy, { data: row.original.phone }) : '—'
		},
		{
			id: 'alerts',
			header: c.alerts,
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
			header: c.allergies,
			enableSorting: false,
			cell: ({ row }) => row.original.allergies.map((a) => a.name).join(', ') || '—'
		},
		{
			id: 'conditions',
			header: c.conditions,
			enableSorting: false,
			cell: ({ row }) => row.original.conditions.join(', ') || '—'
		},
		{
			id: 'bloodType',
			accessorKey: 'bloodType',
			header: c.blood,
			cell: ({ row }) => row.original.bloodType ?? '—'
		},
		{
			id: 'history',
			accessorKey: 'historyTakenAt',
			header: sortable(c.history),
			cell: ({ row }) =>
				renderComponent(HistoryCell, {
					state: row.original.history,
					takenAt: row.original.historyTakenAt
				})
		},
		{
			id: 'referral',
			accessorKey: 'referral',
			header: sortable(c.referral),
			cell: ({ row }) => row.original.referral ?? '—'
		},
		{
			id: 'payer',
			accessorKey: 'payer',
			header: sortable(c.payer),
			cell: ({ row }) => row.original.payer ?? m.patients.list.atTheDesk
		},
		{
			id: 'registered',
			accessorKey: 'registered',
			header: sortable(c.registered),
			cell: ({ row }) =>
				row.original.registered ? formatEthiopianDate(new Date(row.original.registered)) : '—'
		}
	];
	if (!withOwes) return columns;
	// Not sortable: the list is sorted by the server, and a balance is not a column it can sort on.
	return [
		...columns,
		{
			id: 'owes',
			header: c.owes,
			enableSorting: false,
			accessorFn: (row) => row.owes ?? 0,
			cell: ({ row }) => (row.original.owes ? formatETB(row.original.owes) : '—')
		}
	];
}
