import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { PageData } from './$types';

/** One exam, as the tab loads it. */
type PerioExamRow = PageData['exams'][number];

/** A percentage, or a dash when nothing was measured. */
const pct = (n: number | null) => (n === null ? '—' : `${n}%`);

/**
 * The patient's gum exams, newest first. The date opens the exam. "Since the last" is attachment
 * lost or gained by 2 mm or more against the finished exam before it — the trend at a glance.
 */
export function perioColumns(patientId: number): ColumnDef<PerioExamRow>[] {
	return [
		{
			id: 'examinedOn',
			header: 'Date',
			accessorFn: (row) => row.examinedOn,
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: row.original.id,
					name: ethiopianDate(row.original.examinedOn),
					link: `/dashboard/patients/${patientId}/perio`
				})
		},
		{
			id: 'status',
			header: 'Status',
			accessorFn: (row) => (row.completedAt ? 'Finished' : 'Being charted')
		},
		{ id: 'provider', header: 'Probed by', accessorFn: (row) => row.provider ?? '—' },
		{ id: 'teeth', header: 'Teeth', accessorFn: (row) => row.summary.teethPresent },
		{ id: 'deep', header: 'Pockets 4+', accessorFn: (row) => row.summary.deep },
		{ id: 'veryDeep', header: 'Pockets 6+', accessorFn: (row) => row.summary.veryDeep },
		{ id: 'bleeding', header: 'Bleeding', accessorFn: (row) => pct(row.summary.bleedingPercent) },
		{ id: 'plaque', header: 'Plaque', accessorFn: (row) => pct(row.summary.plaquePercent) },
		{
			id: 'change',
			header: 'Since the last',
			accessorFn: (row) =>
				row.changes ? `${row.changes.worse} worse · ${row.changes.better} better` : '—'
		}
	];
}
