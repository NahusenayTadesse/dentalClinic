import type { ColumnDef } from '@tanstack/table-core';
import type { SuperValidated } from 'sveltekit-superforms';
import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { ethiopianDate } from '$lib/tableCells';
import CancelCell from './CancelCell.svelte';
import type { PageData } from './$types';

/** One prescription, as the tab loads it. */
type Row = PageData['prescriptions'][number];

/**
 * The patient's prescriptions. "Print" opens the sheet; the antibiotic column is there so the
 * stewardship question — how often do we reach for one — can be seen, and filtered, per patient.
 */
export function prescriptionColumns(
	patientId: number,
	cancel: SuperValidated<Record<string, unknown>> | null
): ColumnDef<Row>[] {
	const columns: ColumnDef<Row>[] = [
		{
			id: 'prescribedOn',
			header: 'Date',
			accessorFn: (row) => row.prescribedOn,
			cell: ({ row }) => ethiopianDate(row.original.prescribedOn)
		},
		{ accessorKey: 'medicines', header: 'Medicines' },
		{
			id: 'antibiotic',
			header: 'Antibiotic',
			accessorFn: (row) => (row.antibiotic ? 'Antibiotic' : 'No antibiotic'),
			cell: ({ row }) => (row.original.antibiotic ? 'Yes' : '—')
		},
		{ accessorKey: 'indication', header: 'For' },
		// Plain text: a dentist has no page of their own to link to yet (CLAUDE.md §12).
		{ accessorKey: 'provider', header: 'Prescriber' },
		{
			id: 'print',
			header: '',
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: `${row.original.id}/print`,
					name: 'Print',
					link: `/dashboard/patients/${patientId}/prescriptions`,
					target: '_blank'
				})
		}
	];
	if (cancel) {
		columns.push({
			id: 'cancel',
			header: '',
			cell: ({ row }) => renderComponent(CancelCell, { id: row.original.id, data: cancel })
		});
	}
	return columns;
}
