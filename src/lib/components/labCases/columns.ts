import type { ColumnDef } from '@tanstack/table-core';
import type { SuperValidated } from 'sveltekit-superforms';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Copy from '@nahu/admin-kit/Copy.svelte';
import { formatETB } from '$lib/global.svelte';
import { ethiopianDate } from '$lib/tableCells';
import { LAB_STATUS_LABEL, isLabCaseStatus, type LabCaseRow } from '$lib/labCaseStatus';
import { whereLabel } from '$lib/teeth';
import LabCaseMoves from './LabCaseMoves.svelte';

/**
 * The lab case columns, for the board and for one patient's tab. The board adds who the case is
 * for; both end in the moves, when the viewer may make them (`lab_cases.manage`).
 */
export function labCaseColumns({
	withPatient,
	move
}: {
	withPatient: boolean;
	move: SuperValidated<Record<string, unknown>> | null;
}): ColumnDef<LabCaseRow>[] {
	const columns: ColumnDef<LabCaseRow>[] = [];
	if (withPatient) {
		columns.push(
			{
				id: 'patient',
				header: 'Patient',
				accessorFn: (row) => row.patient ?? '',
				cell: ({ row }) =>
					renderComponent(DataTableLinks, {
						entity: 'patient',
						id: row.original.patientId,
						name: row.original.patient ?? ''
					})
			},
			{
				id: 'phone',
				header: 'Phone',
				accessorFn: (row) => row.phone ?? '',
				cell: ({ row }) => renderComponent(Copy, { data: row.original.phone ?? '' })
			}
		);
	}
	columns.push(
		{ accessorKey: 'lab', header: 'Laboratory' },
		{
			id: 'work',
			header: 'Work',
			accessorFn: (row) => row.work ?? row.instructions ?? '—',
			cell: ({ row }) => {
				const r = row.original;
				const where =
					r.toothId === null && !r.toothRange
						? ''
						: ` · ${whereLabel({ toothId: r.toothId, surfaces: null, toothRange: r.toothRange })}`;
				return `${r.work ?? 'See docket'}${where}${r.shade ? ` · shade ${r.shade}` : ''}`;
			}
		},
		{
			id: 'status',
			header: 'Where it is',
			accessorFn: (row) =>
				row.overdue
					? 'Overdue from the lab'
					: isLabCaseStatus(row.status)
						? LAB_STATUS_LABEL[row.status].label
						: row.status
		},
		{
			id: 'sentOn',
			header: 'Sent',
			accessorFn: (row) => row.sentOn,
			cell: ({ row }) => ethiopianDate(row.original.sentOn)
		},
		{
			id: 'dueOn',
			header: 'Due back',
			accessorFn: (row) => row.dueOn,
			cell: ({ row }) =>
				`${ethiopianDate(row.original.dueOn)}${row.original.overdue ? ' · overdue' : ''}`
		},
		{
			id: 'receivedOn',
			header: 'Received',
			accessorFn: (row) => row.receivedOn,
			cell: ({ row }) => ethiopianDate(row.original.receivedOn)
		},
		{
			id: 'remakes',
			header: 'Remakes',
			accessorFn: (row) => row.remakes,
			cell: ({ row }) => (row.original.remakes ? String(row.original.remakes) : '—')
		},
		{
			id: 'labFee',
			header: 'Lab fee',
			accessorFn: (row) => row.labFee,
			cell: ({ row }) => (row.original.labFee === null ? '—' : formatETB(row.original.labFee))
		},
		// Plain text: a dentist has no page of their own to link to yet (CLAUDE.md §12).
		// `||`: the server's `providerName` is a concatenation, so no dentist reads '' rather than null.
		{ id: 'provider', header: 'Dentist', accessorFn: (row) => row.provider || '—' }
	);
	if (move) {
		columns.push({
			id: 'moves',
			header: '',
			cell: ({ row }) =>
				renderComponent(LabCaseMoves, {
					id: row.original.id,
					status: row.original.status,
					data: move
				})
		});
	}
	return columns;
}
