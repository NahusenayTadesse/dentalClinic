import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';

/** One row of the table this file describes, taken from the load so the two cannot drift. */
type RowData = NonNullable<PageData['permissionList']>[number];

import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';

export const columns: ColumnDef<RowData>[] = [
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
		enableSorting: false
	},

	{
		accessorKey: 'description',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Name',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'name',
		header: 'Description'
	}
];
