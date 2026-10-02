import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import PlanStatusBadge from '$lib/components/PlanStatusBadge.svelte';
import { PLAN_STATUS_LABEL } from '$lib/treatmentPlanStatus';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import type { PageData } from './$types';

/** One row of the patient's plans, as the tab loads it. */
type PlanRow = PageData['plans'][number];

/**
 * The patient's plans. The date opens the plan. `status` holds the words a reader filters by, so
 * the facet reads "Awaiting answer" rather than `presented`.
 */
export function planColumns(patientId: number): ColumnDef<PlanRow>[] {
	return [
		{
			id: 'created',
			header: 'Drawn up',
			accessorFn: (row) => row.createdAt,
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: row.original.id,
					name: ethiopianDate(row.original.createdAt),
					link: `/dashboard/patients/${patientId}/plans`
				})
		},
		{
			id: 'status',
			header: 'Status',
			accessorFn: (row) => PLAN_STATUS_LABEL[row.status],
			cell: ({ row }) => renderComponent(PlanStatusBadge, { status: row.original.status })
		},
		{
			id: 'provider',
			header: 'Proposed by',
			accessorFn: (row) => row.provider ?? '—'
		},
		{ accessorKey: 'lines', header: 'Lines' },
		{
			accessorKey: 'quoted',
			header: 'Quoted',
			cell: ({ row }) => formatETB(row.original.quoted)
		},
		{
			accessorKey: 'accepted',
			header: 'Agreed',
			cell: ({ row }) => (row.original.decidedOn ? formatETB(row.original.accepted) : '—')
		},
		{
			id: 'validUntil',
			header: 'Quote stands until',
			accessorFn: (row) => row.validUntil,
			cell: ({ row }) => (row.original.validUntil ? ethiopianDate(row.original.validUntil) : '—')
		}
	];
}
