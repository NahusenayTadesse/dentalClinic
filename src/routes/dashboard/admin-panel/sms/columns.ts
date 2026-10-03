import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DeleteEntity from '@nahu/admin-kit/components/DeleteEntity.svelte';
import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
import BigText from '@nahu/admin-kit/components/Table/bigText.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB } from '$lib/global.svelte';
import { clinicClock, clinicDate } from '$lib/clinicTime';
import RowButtons from '$lib/components/Table/row-buttons.svelte';
import Send from '@lucide/svelte/icons/send';
import SquarePen from '@lucide/svelte/icons/square-pen';
import type { PageData } from './$types';

type Account = PageData['accounts'][number];
type Message = PageData['log'][number];

/**
 * The gateway accounts. The key column is its hint only — the key never reaches this page. Editing
 * and removing are offered to a super admin; anyone on the screen can send a test.
 */
export function accountColumns(
	names: Record<string, string>,
	canManageKeys: boolean,
	on: { edit: (row: Account) => void; test: (row: Account) => void }
): ColumnDef<Account>[] {
	return [
		{ accessorKey: 'label', header: 'Account' },
		{ id: 'provider', header: 'Gateway', accessorFn: (row) => names[row.provider] ?? row.provider },
		{ accessorKey: 'apiKeyHint', header: 'API key' },
		{ id: 'sender', header: 'Sends as', accessorFn: (row) => row.senderName ?? '—' },
		{
			id: 'cost',
			header: 'Per segment',
			accessorFn: (row) => (row.costPerSegment === null ? '—' : formatETB(row.costPerSegment))
		},
		{
			id: 'default',
			header: 'In use',
			cell: ({ row }) =>
				row.original.isDefault ? renderComponent(Statuses, { status: 'Active' }) : ''
		},
		{
			id: 'actions',
			header: '',
			enableSorting: false,
			cell: ({ row }) =>
				renderComponent(RowButtons, {
					buttons: [
						{ label: 'Test', icon: Send, onclick: () => on.test(row.original) },
						...(canManageKeys
							? [{ label: 'Edit', icon: SquarePen, onclick: () => on.edit(row.original) }]
							: [])
					]
				})
		},
		{
			id: 'remove',
			header: '',
			enableSorting: false,
			cell: ({ row }) =>
				renderComponent(DeleteEntity, {
					entity: 'SMS account',
					name: row.original.label,
					id: row.original.id,
					action: '?/removeAccount',
					consequence: row.original.isDefault
						? 'Messages will go through the next account, or stop if there is none.'
						: 'Messages already sent keep their log.',
					icon: true,
					canDelete: canManageKeys
				})
		}
	];
}

/** Every message in the window, newest first: what went, to whom, whether it arrived at the gateway, and its cost. */
export function logColumns(names: Record<string, string>): ColumnDef<Message>[] {
	return [
		{
			id: 'when',
			header: 'Sent',
			accessorFn: (row) => row.sentAt,
			cell: ({ row }) => `${clinicDate(row.original.sentAt)} ${clinicClock(row.original.sentAt)}`
		},
		{
			id: 'kind',
			header: 'For',
			accessorFn: (row) =>
				({ reminder: 'Reminder', recall: 'Recall', test: 'Test', payment: 'Payment link' })[
					row.kind
				]
		},
		{
			id: 'patient',
			header: 'Patient',
			accessorFn: (row) => row.patient ?? '—',
			cell: ({ row }) =>
				row.original.patientId && row.original.patient
					? renderComponent(DataTableLinks, {
							entity: 'patient',
							id: row.original.patientId,
							name: row.original.patient
						})
					: '—'
		},
		{ accessorKey: 'toPhone', header: 'To' },
		{
			id: 'body',
			header: 'Message',
			cell: ({ row }) => renderComponent(BigText, { text: row.original.body, max: 40 })
		},
		{ id: 'provider', header: 'Gateway', accessorFn: (row) => names[row.provider] ?? row.provider },
		{
			id: 'status',
			header: 'Status',
			accessorFn: (row) => (row.status === 'sent' ? 'Sent' : 'Failed'),
			cell: ({ row }) =>
				row.original.status === 'sent'
					? renderComponent(Statuses, { status: 'Sent' })
					: `Failed — ${row.original.error ?? 'no reason given'}`
		},
		{ accessorKey: 'segments', header: 'Segments', meta: { align: 'right' } },
		{
			id: 'cost',
			header: 'Cost',
			meta: { align: 'right' },
			accessorFn: (row) => (row.cost === null ? '—' : formatETB(row.cost))
		}
	];
}
