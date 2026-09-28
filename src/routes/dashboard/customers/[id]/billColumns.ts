import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import InvoiceStatusBadge from '$lib/components/InvoiceStatusBadge.svelte';
import { INVOICE_STATUS_LABEL } from '$lib/invoiceStatus';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { PageData } from './$types';

/** One bill billed to this payer, as the page loads it. */
type PayerBill = NonNullable<PageData['account']>['bills'][number];

/**
 * The bills an employer or insurer is paying, across their patients. The bill opens on the
 * patient's chart, where bills live; the patient links to theirs, for a viewer who may open it.
 */
export const payerBillColumns: ColumnDef<PayerBill>[] = [
	{
		id: 'number',
		header: 'Bill',
		accessorFn: (row) => row.invoiceNumber ?? '',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.invoiceNumber,
				link: `/dashboard/patients/${row.original.patientId}/billing`
			})
	},
	{
		accessorKey: 'patient',
		header: 'Patient',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.patientId,
				name: row.original.patient,
				entity: 'patient'
			})
	},
	{
		id: 'issuedOn',
		header: 'Issued',
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
