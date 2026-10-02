import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Copy from '@nahu/admin-kit/Copy.svelte';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { Messages } from '$lib/i18n/messages';
import type { PageData } from './$types';

/** One patient who owes money. */
type Row = PageData['owing'][number];

/**
 * The receivables list. The name opens the patient's chart (checked against the viewer's access,
 * CLAUDE.md §12); "Open bills" goes to their Billing tab, where a payment is taken. Built from the
 * viewer's messages, so the page rebuilds it when the language changes.
 */
export function receivableColumns(m: Messages): ColumnDef<Row>[] {
	const w = m.billing.owes;
	return [
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
		{ accessorKey: 'bills', header: w.unpaidBills },
		{
			id: 'oldest',
			header: w.oldest,
			accessorFn: (row) => row.oldest,
			cell: ({ row }) => ethiopianDate(row.original.oldest)
		},
		{ accessorKey: 'owed', header: w.owesColumn, cell: ({ row }) => formatETB(row.original.owed) },
		{
			id: 'open',
			header: '',
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: 'billing',
					name: w.openBills,
					link: `/dashboard/patients/${row.original.patientId}`
				})
		}
	];
}

/** One employer or insurer who owes money. */
type PayerRow = PageData['payers'][number];

/**
 * The payers who owe. The name opens the payer's page, where their bills are listed and their
 * payment is taken across patients.
 */
export function payerColumns(m: Messages): ColumnDef<PayerRow>[] {
	const w = m.billing.owes;
	return [
		{
			id: 'payer',
			header: w.payer,
			accessorFn: (row) => row.payer,
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					entity: 'customer',
					id: row.original.customerId,
					name: row.original.payer
				})
		},
		{
			accessorKey: 'phone',
			header: m.common.phone,
			cell: ({ row }) => renderComponent(Copy, { data: row.original.phone })
		},
		{ accessorKey: 'bills', header: w.unpaidBills },
		{
			id: 'oldest',
			header: w.oldest,
			accessorFn: (row) => row.oldest,
			cell: ({ row }) => ethiopianDate(row.original.oldest)
		},
		{ accessorKey: 'owed', header: w.owesColumn, cell: ({ row }) => formatETB(row.original.owed) }
	];
}
