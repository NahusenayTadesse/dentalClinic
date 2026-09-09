import type { ColumnDef, HeaderContext } from '@tanstack/table-core';
import type { SuperValidated } from 'sveltekit-superforms';
import { renderComponent } from '$lib/components/ui/data-table/index.js';

import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import DeleteEntity from '$lib/components/DeleteEntity.svelte';
import LookupEdit from './LookupEdit.svelte';
import type { LookupConfig, LookupField, LookupOptions, LookupRow } from './types';

/** The validated form a lookup route hands to its dialogs. */
export type LookupForm = SuperValidated<Record<string, unknown>>;

/** A boolean cell reads as a status badge, in the field's own wording. */
function badgeText(field: LookupField, value: unknown): string {
	return value ? (field.trueLabel ?? 'Active') : (field.falseLabel ?? 'Inactive');
}

function sortableHeader(label: string) {
	return ({ column }: HeaderContext<LookupRow, unknown>) =>
		renderComponent(DataTableSort, { name: label, onclick: column.getToggleSortingHandler() });
}

/**
 * The table for a lookup screen, built from its descriptor.
 *
 * Column order follows `config.fields`, framed by the row number, the edit button and the
 * delete button — the layout every one of these pages already had. The first field is the
 * label column and doubles as the edit trigger.
 *
 * `editForm` and `canDelete` come from the page rather than the descriptor: one is a validated
 * form object and the other is the viewer's own privilege, and neither is a property of the
 * table being edited.
 */
export function lookupColumns(
	config: LookupConfig,
	{
		editForm,
		canDelete = false,
		options,
		actions = { edit: '?/edit', delete: '?/delete' }
	}: {
		editForm: LookupForm;
		canDelete?: boolean;
		options?: LookupOptions;
		/**
		 * Where the row's edit and delete forms post.
		 *
		 * A page has one table and can use `?/edit`; a detail page hosts several and needs
		 * `?/editFamily`, `?/editQualification` and so on.
		 */
		actions?: { edit: string; delete: string };
	}
): ColumnDef<LookupRow>[] {
	const [labelField, ...rest] = config.fields;

	return [
		{
			id: 'index',
			header: '#',
			enableSorting: false,
			cell: (info) => info.table.getRowModel().rows.findIndex((row) => row.id === info.row.id) + 1
		},

		{
			accessorKey: labelField.name,
			header: sortableHeader(labelField.label),
			// The name is the link that opens the editor, so there is no separate "view" action.
			cell: ({ row }) =>
				renderComponent(LookupEdit, {
					row: row.original,
					fields: config.fields,
					entity: config.entity,
					data: editForm,
					options,
					action: actions.edit,
					icon: false
				})
		},

		...rest
			.filter((field) => field.inTable !== false)
			.map((field): ColumnDef<LookupRow> => {
				const isFlag = field.type === 'boolean' || field.type === 'checkbox';

				// A reference sorts and reads on the joined *name*, never the raw id.
				if (field.type === 'reference') {
					return {
						accessorKey: field.display ?? field.name,
						header: sortableHeader(field.label)
					};
				}

				return {
					accessorKey: field.name,
					header: isFlag ? sortableHeader(field.label) : field.label,
					...(isFlag
						? {
								cell: ({ row }) =>
									renderComponent(Statuses, {
										status: badgeText(field, row.original[field.name])
									})
							}
						: {})
				};
			}),

		...(config.extraColumns ?? []),

		{
			id: 'edit',
			header: 'Edit',
			enableSorting: false,
			cell: ({ row }) =>
				renderComponent(LookupEdit, {
					row: row.original,
					fields: config.fields,
					entity: config.entity,
					data: editForm,
					options,
					action: actions.edit,
					icon: true
				})
		},

		{
			id: 'delete',
			header: '',
			enableSorting: false,
			// Renders nothing unless the viewer is a super admin; the action re-checks server-side.
			cell: ({ row }) =>
				renderComponent(DeleteEntity, {
					entity: config.entity,
					name: String(row.original[labelField.name] ?? ''),
					id: row.original.id,
					icon: true,
					canDelete,
					action: actions.delete
				})
		}
	];
}
