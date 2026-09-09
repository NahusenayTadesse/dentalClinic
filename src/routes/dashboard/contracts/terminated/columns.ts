import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import Copy from '$lib/Copy.svelte';

import { formatETB, formatEthiopianDate, formatEthiopianYear } from '$lib/global.svelte';
import BigText from '$lib/components/Table/bigText.svelte';

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
		accessorKey: 'Contract Page',
		header: 'Contract Page',
		sortable: true,
		cell: ({ row }) => {
			return renderComponent(DataTableLinks, {
				id: row.original.id + '/payment-history',
				name: row.original.site + ': ' + row.original.service + ': ' + row.original.monthlyAmount,

				link: '/dashboard/contracts'
			});
		}
	},
	{
		accessorKey: 'site',
		header: 'Site',
		sortable: true,
		cell: ({ row }) => {
			return renderComponent(DataTableLinks, {
				id: row.original.siteId,
				name: row.original.site,
				link: '/dashboard/sites',

				target: '_blank'
			});
		}
	},
	{
		accessorKey: 'contractYear',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Contract Year',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},

	{
		accessorKey: 'service',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Service',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},

	{
		accessorKey: 'monthlyAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Monthly Amount',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return formatETB(info.getValue(), true);
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
		accessorKey: 'startDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Contract Start Date',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return formatEthiopianDate(info.getValue());
		}
	},
	{
		accessorKey: 'endDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Contract End Date',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return formatEthiopianDate(info.getValue());
		}
	},
	{
		accessorKey: 'terminationDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Contract Termination Date',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return formatEthiopianDate(info.getValue());
		}
	},
	{
		accessorKey: 'signedDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Signed On',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return formatEthiopianDate(info.getValue());
		}
	},

	{
		accessorKey: 'numberOfRenewals',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'No of Renewals',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			const number = info.getValue() ?? 0;
			return number + ' Renewals';
		}
	},
	{
		accessorKey: 'status',
		header: 'Status',
		sortable: true,
		cell: ({ row }) => {
			return renderComponent(Statuses, {
				status: 'Terminated'
			});
		}
	},

	{
		accessorKey: 'terminationReason',
		header: 'Termination Reason',
		sortable: true,
		cell: ({ row }) => {
			return renderComponent(BigText, {
				text: row.original.terminationReason ? row.original.terminationReason : 'No Reason Provided'
			});
		}
	},
	{
		accessorKey: 'officeCommission',
		header: 'Office Commission',
		sortable: true,
		cell: ({ row }) => {
			return renderComponent(Statuses, {
				status: row.original.status ? 'Yes' : 'No'
			});
		}
	},
	{
		accessorKey: 'contractFile',
		header: 'Contract File',
		sortable: true,
		cell: ({ row }) => {
			return renderComponent(DataTableLinks, {
				id: row.original.contractFile ? row.original.contractFile : '',
				name: row.original.contractFile ? 'Contract File' : 'File Not Uploaded',
				link: '/dashboard/files',
				target: '_blank'
			});
		}
	},

	{
		accessorKey: 'signingOfficerName',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Signing Officer',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.signingOfficer,
				name: row.original.signingOfficerName, // Fallback for safety
				link: `/dashboard/employees/single`,
				target: '_blank'
			});
		}
	},

	{
		accessorKey: 'addedBy',
		header: 'Added By',
		sortable: true,
		cell: ({ row }) => {
			return renderComponent(DataTableLinks, {
				id: row.original.addedById,
				name: row.original.addedBy,
				link: '/dashboard/admin-panel/users',

				target: '_blank'
			});
		}
	}
];
