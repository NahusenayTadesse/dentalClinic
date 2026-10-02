import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Copy from '$lib/Copy.svelte';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { PageData } from './$types';

/** One patient who owes money. */
type Row = PageData['owing'][number];

/**
 * The receivables list. The name opens the patient's chart (checked against the viewer's access,
 * CLAUDE.md §12); "Open bills" goes to their Billing tab, where a payment is taken.
 */
export const columns: ColumnDef<Row>[] = [
	{
		id: 'patient',
		header: 'Patient',
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
		header: 'Phone',
		cell: ({ row }) => renderComponent(Copy, { data: row.original.phone })
	},
	{ accessorKey: 'bills', header: 'Unpaid bills' },
	{
		id: 'oldest',
		header: 'Oldest',
		accessorFn: (row) => row.oldest,
		cell: ({ row }) => ethiopianDate(row.original.oldest)
	},
	{ accessorKey: 'owed', header: 'Owes', cell: ({ row }) => formatETB(row.original.owed) },
	{
		id: 'open',
		header: '',
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: 'billing',
				name: 'Open bills',
				link: `/dashboard/patients/${row.original.patientId}`
			})
	}
];

/** One employer or insurer who owes money. */
type PayerRow = PageData['payers'][number];

/**
 * The payers who owe. The name opens the payer's page, where their bills are listed and their
 * payment is taken across patients.
 */
export const payerColumns: ColumnDef<PayerRow>[] = [
	{
		id: 'payer',
		header: 'Payer',
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
		header: 'Phone',
		cell: ({ row }) => renderComponent(Copy, { data: row.original.phone })
	},
	{ accessorKey: 'bills', header: 'Unpaid bills' },
	{
		id: 'oldest',
		header: 'Oldest',
		accessorFn: (row) => row.oldest,
		cell: ({ row }) => ethiopianDate(row.original.oldest)
	},
	{ accessorKey: 'owed', header: 'Owes', cell: ({ row }) => formatETB(row.original.owed) }
];
