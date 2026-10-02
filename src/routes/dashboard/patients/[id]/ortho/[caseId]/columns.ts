import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import { INSTALMENT_STATE_LABEL } from '$lib/orthoPlan';
import type { PageData } from './$types';

/** One instalment of the plan, as the page loads it. */
type InstalmentRow = PageData['case']['instalments'][number];

/** The payment plan: each instalment, when it falls due, and its bill once it has one. */
export function instalmentColumns(patientId: number): ColumnDef<InstalmentRow>[] {
	return [
		{ id: 'n', header: '', accessorFn: (row) => (row.n === 0 ? 'Deposit' : `Instalment ${row.n}`) },
		{ id: 'dueOn', header: 'Due', accessorFn: (row) => ethiopianDate(row.dueOn) },
		{ id: 'amount', header: 'Amount', accessorFn: (row) => formatETB(row.amount) },
		{ id: 'state', header: 'State', accessorFn: (row) => INSTALMENT_STATE_LABEL[row.state] },
		{
			id: 'bill',
			header: 'Bill',
			accessorFn: (row) => row.invoiceNumber ?? '—',
			cell: ({ row }) =>
				row.original.invoiceId
					? renderComponent(DataTableLinks, {
							id: row.original.invoiceId,
							name: row.original.invoiceNumber ?? 'Bill',
							link: `/dashboard/patients/${patientId}/billing`
						})
					: '—'
		}
	];
}
