import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DeleteEntity from '$lib/components/DeleteEntity.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import Copy from '$lib/Copy.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatEthiopianDate, formatETB } from '$lib/global.svelte';
import BigText from '$lib/components/Table/bigText.svelte';

export const columns = [
	{
		id: 'index',
		header: '#',
		cell: (info) => info.table.getRowModel().rows.findIndex((r) => r.id === info.row.id) + 1
	},
	{
		accessorKey: 'date',
		header: 'Payment Date',
		cell: ({ row }) => formatEthiopianDate(new Date(row.original.date))
	},
	{
		accessorKey: 'month',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Month',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'year',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Year',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'date',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Payment Date',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => formatEthiopianDate(new Date(row.original.date))
	},
	{
		accessorKey: 'requestAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Requested Amount',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatETB(info.getValue());
		}
	},
	{
		accessorKey: 'beforeVat',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Before Vat',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatETB(info.getValue());
		}
	},
	{
		accessorKey: 'vat',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Vat',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return info.getValue() + '%';
		}
	},
	{
		accessorKey: 'withholdAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Withhold Amount',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatETB(info.getValue());
		}
	},
	{
		accessorKey: 'penalityAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Penality Amount',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatETB(info.getValue());
		}
	},
	{
		accessorKey: 'paymentAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Payment Amount',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatETB(info.getValue());
		}
	},
	{
		accessorKey: 'fsNumber',
		header: 'FS Number',
		cell: ({ row }) => renderComponent(Copy, { data: row.original.fsNumber })
	},

	{
		accessorKey: 'invoiceNumber',
		header: 'Invoice Number',
		cell: ({ row }) => renderComponent(Copy, { data: row.original.invoiceNumber })
	},
	{
		accessorKey: 'withholdInvoiceNumber',
		header: 'Withhold Invoice Number',
		cell: ({ row }) => renderComponent(Copy, { data: row.original.withholdInvoiceNumber })
	},
	{
		accessorKey: 'paymentMethod',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Bank or Payment Method',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'requestChangeReason',
		header: 'Request Change Reason',
		cell: ({ row }) => renderComponent(BigText, { text: row.original.requestChangeReason ?? '' })
	},

	{
		accessorKey: 'addedBy',
		header: 'Processed By',
		cell: ({ row }) => row.original.addedBy
	},

	{
		accessorKey: 'requestFile',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Request Document',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		// Using DataTableLinks to view staff profile
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.requestFile,
				name: row.original.requestFile ? 'View Request Document' : 'No Request Document Added', // Fallback for safety
				link: row.original.requestFile ? `/dashboard/files` : '',
				target: '_blank'
			});
		}
	},

	{
		accessorKey: 'withholdFile',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Withhold Document',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		// Using DataTableLinks to view staff profile
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.withholdFile,
				name: row.original.withholdFile ? 'View Withhold Document' : 'No Withhold Document Added', // Fallback for safety
				link: row.original.withholdFile ? `/dashboard/files` : '',
				target: '_blank'
			});
		}
	},
	{
		accessorKey: 'receiptFile',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Bank Statement',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		// Using DataTableLinks to view staff profile
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.receiptFile,
				name: row.original.receiptFile ? 'View Bank Statement' : 'No Bank Statement Added', // Fallback for safety
				link: row.original.receiptFile ? `/dashboard/files` : '',
				target: '_blank'
			});
		}
	}
];

/**
 * Built per request rather than exported as a constant: the delete column
 * needs to know whether the viewer is a super admin, which only the page has.
 */
export const makeRenewalColumns = (canDelete = false) => [
	{
		id: 'index',
		header: '#',
		cell: (info) => info.table.getRowModel().rows.findIndex((r) => r.id === info.row.id) + 1
	},

	{
		accessorKey: 'renewalAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Monthly Amount',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return formatETB(info.getValue());
		}
	},

	{
		accessorKey: 'renewalDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Renewal Signing Date',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatEthiopianDate(new Date(info.getValue()))
	},
	{
		accessorKey: 'renewalDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Renewal Signing Date',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatEthiopianDate(new Date(info.getValue()))
	},
	{
		accessorKey: 'renewalStartDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Renewal Start Date',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatEthiopianDate(new Date(info.getValue()))
	},

	{
		accessorKey: 'renewalEndDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Renewal End Date',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatEthiopianDate(new Date(info.getValue()))
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
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Added By',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.createdBy,
				name: row.original.addedBy, // Fallback for safety
				link: `/dashboard/admin-panel/users`,
				target: '_blank'
			});
		}
	},

	{
		accessorKey: 'contractFile',
		header: 'Contract File',
		sortable: true,
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return row.original.contractFile
				? renderComponent(DataTableLinks, {
						id: row.original.contractFile,
						name: 'Contract File', // Fallback for safety
						link: `/dashboard/files`,
						target: '_blank'
					})
				: 'No Contract File Added';
		}
	},

	{
		id: 'delete',
		header: '',
		enableSorting: false,
		// Renders nothing unless `canDelete`; the action re-checks on the server.
		cell: ({ row }) =>
			renderComponent(DeleteEntity, {
				entity: 'Renewal',
				name: row.original?.renewalDate,
				id: row.original?.id,
				action: '?/deleteRenewal',
				icon: true,
				canDelete
			})
	}
];
