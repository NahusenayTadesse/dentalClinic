import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Copy from '$lib/Copy.svelte';
import DataTableActions from './data-table-actions.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import Address from '$lib/components/Table/address.svelte';
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
				link: '/dashboard/sites'
			});
		}
	},
	{
		accessorKey: 'customerName',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Customer Name',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.customerId,
				name: row.original.customerName,
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
		accessorKey: '',
		header: 'Address',
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(Address, {
				street: row.original.address.street,
				buildingNumber: row.original.address.buildingNumber,
				floor: row.original.address.floor,
				subcity: row.original.address.subcity,
				kebele: row.original.address.kebele,
				houseNumber: row.original.address.houseNumber
			});
		}
	},
	{
		accessorKey: 'expectedPayments',
		header: 'Expected Payments',
		sortable: true,
		cell: ({ row }) =>
			renderComponent(Copy, {
				data: row.original.expectedPayments ? row.original.expectedPayments : '0'
			})
	},
	{
		accessorKey: 'actualPayments',
		header: 'Actual Payments',
		sortable: true,
		cell: ({ row }) =>
			renderComponent(Copy, {
				data: row.original.actualPayments ? row.original.actualPayments : '0'
			})
	},
	{
		accessorKey: 'missingPayments',
		header: 'Missing Payments',
		sortable: true,
		cell: ({ row }) =>
			renderComponent(Copy, {
				data: row.original.missingPayments ? row.original.missingPayments : '0'
			})
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
		accessorKey: 'startedOn',
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
		accessorKey: 'actions',
		header: 'Actions',
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableActions, {
				id: row.original.customerId,
				phone: row.original.phone,
				createdBy: row.original.createdBy,
				createdById: row.original.bookedById,
				customerName: row.original.customerName,
				date: row.original.date
			});
		}
	}
];
