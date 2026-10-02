import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB } from '$lib/global.svelte';
import { clinicClock } from '$lib/clinicTime';
import type { Messages } from '$lib/i18n/messages';
import FoundToggle from './FoundToggle.svelte';
import type { PageData } from './$types';

type Row = PageData['rows'][number];

/**
 * A day's transfers. The reference is the column to read against the statement; `checked` doubles
 * as a facet, so the desk can narrow to what is still to find. Rebuilt in a `$derived` on a switch.
 */
export function transferColumns(m: Messages, canCheck: boolean): ColumnDef<Row>[] {
	const w = m.billing.mobile;
	return [
		{ id: 'time', header: w.time, accessorFn: (row) => clinicClock(row.at) },
		{ id: 'receipt', header: w.receipt, accessorFn: (row) => row.receipt ?? '—' },
		{
			id: 'from',
			header: w.from,
			accessorFn: (row) => row.patient ?? row.payer ?? '—',
			cell: ({ row }) =>
				row.original.patientId && row.original.patient
					? renderComponent(DataTableLinks, {
							entity: 'patient',
							id: row.original.patientId,
							name: row.original.patient
						})
					: (row.original.payer ?? '—')
		},
		{ id: 'method', header: w.method, accessorFn: (row) => row.method },
		{
			id: 'reference',
			header: w.reference,
			accessorFn: (row) => row.reference ?? w.noReference
		},
		{
			id: 'amount',
			header: w.amount,
			meta: { align: 'right' },
			accessorFn: (row) => row.amount,
			cell: ({ row }) => formatETB(row.original.amount)
		},
		{
			id: 'checked',
			header: w.checked,
			accessorFn: (row) => (row.reconciledAt ? w.checked : w.notChecked),
			cell: ({ row }) =>
				renderComponent(FoundToggle, {
					id: row.original.id,
					reconciledAt: row.original.reconciledAt,
					reconciledBy: row.original.reconciledBy,
					canCheck
				})
		}
	];
}
