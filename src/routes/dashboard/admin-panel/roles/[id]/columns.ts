import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';

/** The rows of the two tables here, taken from the load so they cannot drift. */
type PermissionRow = PageData['permissionList'][number];
type UserRow = NonNullable<PageData['userList']>[number];

import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableSort from '@nahu/admin-kit/components/Table/data-table-sort.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
/** The role's permissions. */
export const columns: ColumnDef<PermissionRow>[] = [
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
		enableSorting: false
	},

	{
		accessorKey: 'name',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Name',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'description',
		header: 'Description'
	}
];

/** The users holding the role. */
export const userColumns: ColumnDef<UserRow>[] = [
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => info.row.index + 1,
		enableSorting: false
	},

	{
		accessorKey: 'name',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Name',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.name,
				entity: 'user'
			});
		}
	},

	{
		accessorKey: 'email',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Email',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'isActive',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Active',
				onclick: column.getToggleSortingHandler()
			})
	}
];
