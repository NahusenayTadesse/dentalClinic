import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DeleteEntity from '$lib/components/DeleteEntity.svelte';
import RowButton from '@nahu/admin-kit/components/RowButton.svelte';
import { PAYMENT_KINDS } from './schema';
import type { PageData } from './$types';

/** One payment method, as the page loads it. */
type Row = PageData['allPaymentMethods'][number];

const kindName = (kind: string) => PAYMENT_KINDS.find((k) => k.value === kind)?.name ?? kind;

/** The payment methods. The name opens the one edit dialog, seeded with its row. */
export function paymentMethodColumns({
	onedit,
	canDelete
}: {
	onedit: (row: Row) => void;
	canDelete: boolean;
}): ColumnDef<Row>[] {
	return [
		{
			accessorKey: 'name',
			header: 'Name',
			cell: ({ row }) =>
				renderComponent(RowButton, {
					label: row.original.name,
					onclick: () => onedit(row.original)
				})
		},
		{ id: 'kind', header: 'Kind', accessorFn: (row) => kindName(row.kind) },
		{
			id: 'createdBy',
			header: 'Created by',
			accessorFn: (row) => row.createdBy ?? '',
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					id: row.original.createdById,
					name: row.original.createdBy,
					entity: 'user'
				})
		},
		{
			id: 'delete',
			header: '',
			enableSorting: false,
			// Renders nothing unless the viewer is a super admin; the action re-checks.
			cell: ({ row }) =>
				renderComponent(DeleteEntity, {
					entity: 'Payment Method',
					name: row.original.name,
					id: row.original.id,
					icon: true,
					canDelete
				})
		}
	];
}
