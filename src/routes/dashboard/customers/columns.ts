import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Copy from '$lib/Copy.svelte';
import DataTableActions from './data-table-actions.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { formatEthiopianDate } from '$lib/global.svelte';

export const columns = [
	{
		id: 'index',
		header: '#',
		cell: (info) => {
			const rowIndex = info.table.getRowModel().rows.findIndex((row) => row.id === info.row.id);
			return rowIndex + 1;
		},
		enableSorting: false
	},
	{
		accessorKey: 'name',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Name',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.name,
				link: '/dashboard/customers'
			});
		}
	},
	{
		accessorKey: 'phone',
		header: 'Phone',
		sortable: true,
		cell: ({ row }) => renderComponent(Copy, { data: row.original.phone })
	},
	{
		accessorKey: 'email',
		header: 'Email',
		sortable: true,
		cell: ({ row }) => renderComponent(Copy, { data: row.original.email })
	},
	{
		accessorKey: 'tinNo',
		header: 'Tin Number',
		sortable: true,
		cell: ({ row }) => renderComponent(Copy, { data: row.original.tinNo })
	},

	{
		accessorKey: 'sites',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Sites',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => renderComponent(Copy, { data: row.original.noOfSites })
	},

	{
		accessorKey: 'addedBy',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Added By',
				onclick: column.getToggleSortingHandler()
			}),

		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.addedById,
				name: row.original.addedBy,
				link: '/dashboard/admin-panel/users'
			});
		}
	},

	{
		accessorKey: 'joinedOn',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Joined On',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			const n = info.getValue(); // number of days
			return formatEthiopianDate(new Date(n));
		}
	},
	{
		accessorKey: 'noOfContracts',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'No. of Contracts',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			const n = info.getValue(); // number of days
			return `${n} ${n === 1 ? 'Contract' : 'Contracts'}`;
		}
	},

	{
		accessorKey: 'actions',
		header: 'Actions',
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableActions, {
				id: row.original.extraSettings,
				phone: row.original.phone,
				createdBy: row.original.createdBy,
				createdById: row.original.bookedById,
				customerName: row.original.customerName,
				date: row.original.date
			});
		}
	}
];
