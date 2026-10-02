import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import InvoiceStatusBadge from '$lib/components/InvoiceStatusBadge.svelte';
import { INVOICE_STATUS_LABEL } from '$lib/invoiceStatus';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { PageData } from './$types';

/** One of the patient's bills, as the tab loads it. */
type BillRow = PageData['bills'][number];

/** The patient's bills. The number opens the bill; a draft has none yet, so it says "Draft". */
export function billColumns(patientId: number): ColumnDef<BillRow>[] {
	return [
		{
			id: 'number',
			header: 'Bill',
			accessorFn: (row) => row.invoiceNumber ?? 'Draft',
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: row.original.id,
					name: row.original.invoiceNumber ?? 'Draft',
					link: `/dashboard/patients/${patientId}/billing`
				})
		},
		{
			id: 'issuedOn',
			header: 'Date',
			accessorFn: (row) => row.issuedOn,
			cell: ({ row }) => ethiopianDate(row.original.issuedOn)
		},
		{
			id: 'status',
			header: 'Status',
			accessorFn: (row) =>
				row.approvalStatus === 'pending' ? 'Awaiting a manager' : INVOICE_STATUS_LABEL[row.status],
			cell: ({ row }) =>
				renderComponent(InvoiceStatusBadge, {
					status: row.original.status,
					approvalStatus: row.original.approvalStatus
				})
		},
		{ accessorKey: 'total', header: 'Total', cell: ({ row }) => formatETB(row.original.total) },
		{ accessorKey: 'paid', header: 'Paid', cell: ({ row }) => formatETB(row.original.paid) },
		{
			accessorKey: 'owed',
			header: 'Still owed',
			cell: ({ row }) => (row.original.owed > 0 ? formatETB(row.original.owed) : '—')
		}
	];
}
