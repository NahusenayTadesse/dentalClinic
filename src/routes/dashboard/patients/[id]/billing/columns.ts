import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import InvoiceStatusBadge from '$lib/components/InvoiceStatusBadge.svelte';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { Messages } from '$lib/i18n/messages';
import type { PageData } from './$types';

/** One of the patient's bills, as the tab loads it. */
type BillRow = PageData['bills'][number];

/**
 * The patient's bills, headed in the viewer's language. The number opens the bill; a draft has none
 * yet, so it says "Draft". The status column's value is the badge's word, so its facet reads the
 * same as the badge.
 */
export function billColumns(patientId: number, m: Messages): ColumnDef<BillRow>[] {
	const w = m.billing.tab;
	const status = m.billing.status;
	return [
		{
			id: 'number',
			header: w.bill,
			accessorFn: (row) => row.invoiceNumber ?? status.draft,
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: row.original.id,
					name: row.original.invoiceNumber ?? status.draft,
					link: `/dashboard/patients/${patientId}/billing`
				})
		},
		{
			id: 'issuedOn',
			header: w.date,
			accessorFn: (row) => row.issuedOn,
			cell: ({ row }) => ethiopianDate(row.original.issuedOn)
		},
		{
			id: 'status',
			header: m.common.status,
			accessorFn: (row) =>
				row.approvalStatus === 'pending' ? status.awaitingManager : status[row.status],
			cell: ({ row }) =>
				renderComponent(InvoiceStatusBadge, {
					status: row.original.status,
					approvalStatus: row.original.approvalStatus
				})
		},
		{ accessorKey: 'total', header: w.total, cell: ({ row }) => formatETB(row.original.total) },
		{ accessorKey: 'paid', header: w.paid, cell: ({ row }) => formatETB(row.original.paid) },
		{
			accessorKey: 'owed',
			header: w.stillOwed,
			cell: ({ row }) => (row.original.owed > 0 ? formatETB(row.original.owed) : '—')
		}
	];
}
