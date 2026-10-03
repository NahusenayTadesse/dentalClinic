import type { ColumnDef } from '@tanstack/table-core';
import SquarePen from '@lucide/svelte/icons/square-pen';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import RowButtons from '$lib/components/Table/row-buttons.svelte';
import { formatETB } from '$lib/global.svelte';
import { clinicClock, clinicDate } from '$lib/clinicTime';
import { GATEWAY_INFO } from '$lib/paymentGateways';
import type { PageData } from './$types';

type Account = PageData['accounts'][number];
type Payment = PageData['log'][number];

/** The settings that are not secret, in the order the gateway lists them. */
function settingsOf(row: Account): string {
	return GATEWAY_INFO[row.provider].fields
		.filter((f) => !f.secret && row.settings[f.key])
		.map((f) => `${f.label}: ${row.settings[f.key]}`)
		.join(' · ');
}

/**
 * The gateway accounts. The key column is a hint only — the keys never reach this page. Editing and
 * removing are a super admin's.
 */
export function accountColumns(
	canManageKeys: boolean,
	onedit: (row: Account) => void
): ColumnDef<Account>[] {
	return [
		{ accessorKey: 'label', header: 'Account' },
		{ id: 'provider', header: 'Gateway', accessorFn: (row) => GATEWAY_INFO[row.provider].name },
		{
			id: 'mode',
			header: 'Mode',
			accessorFn: (row) => (row.mode === 'live' ? 'Live' : 'Test'),
			cell: ({ row }) =>
				renderComponent(Statuses, { status: row.original.mode === 'live' ? 'Live' : 'Test' })
		},
		{ accessorKey: 'secretHint', header: 'Key' },
		{ id: 'settings', header: 'Settings', accessorFn: (row) => settingsOf(row) || '—' },
		{
			id: 'enabled',
			header: 'At the desk',
			accessorFn: (row) => (row.enabled ? 'On' : 'Off'),
			cell: ({ row }) =>
				renderComponent(Statuses, { status: row.original.enabled ? 'Active' : 'Inactive' })
		},
		{
			id: 'actions',
			header: '',
			enableSorting: false,
			cell: ({ row }) =>
				canManageKeys
					? renderComponent(RowButtons, {
							buttons: [{ label: 'Edit', icon: SquarePen, onclick: () => onedit(row.original) }]
						})
					: ''
		},
		{
			id: 'remove',
			header: '',
			enableSorting: false,
			cell: ({ row }) =>
				renderComponent(DeleteEntity, {
					entity: 'gateway account',
					name: row.original.label,
					id: row.original.id,
					action: '?/remove',
					consequence:
						'It stops being offered at the desk. Payments already asked for through it can still be checked.',
					icon: true,
					canDelete: canManageKeys
				})
		}
	];
}

const STATUS_LABEL = {
	pending: 'Waiting',
	paid: 'Paid',
	failed: 'Failed',
	cancelled: 'Cancelled'
} as const;

/** Every online payment in the window, newest first. */
export function logColumns(): ColumnDef<Payment>[] {
	return [
		{
			id: 'when',
			header: 'Asked',
			accessorFn: (row) => row.askedAt,
			cell: ({ row }) => `${clinicDate(row.original.askedAt)} ${clinicClock(row.original.askedAt)}`
		},
		{
			id: 'patient',
			header: 'Patient',
			accessorFn: (row) => row.patient ?? '—',
			cell: ({ row }) =>
				row.original.patient
					? renderComponent(DataTableLinks, {
							entity: 'patient',
							id: row.original.patientId,
							name: row.original.patient
						})
					: '—'
		},
		{ id: 'provider', header: 'Gateway', accessorFn: (row) => GATEWAY_INFO[row.provider].name },
		{ accessorKey: 'account', header: 'Account' },
		{
			id: 'amount',
			header: 'Amount',
			meta: { align: 'right' },
			accessorFn: (row) => formatETB(row.amount)
		},
		{
			id: 'status',
			header: 'Status',
			accessorFn: (row) => STATUS_LABEL[row.status],
			cell: ({ row }) =>
				row.original.status === 'failed' && row.original.error
					? `Failed — ${row.original.error}`
					: STATUS_LABEL[row.original.status]
		},
		{ id: 'receipt', header: 'Receipt', accessorFn: (row) => row.receiptNumber ?? '—' },
		{ accessorKey: 'reference', header: 'Our reference' },
		{
			id: 'providerReference',
			header: 'Gateway reference',
			accessorFn: (row) => row.providerReference ?? '—'
		}
	];
}
