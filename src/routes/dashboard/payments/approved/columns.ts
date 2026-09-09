import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import Copy from '$lib/Copy.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import type { ColumnDef } from '@tanstack/table-core';
import { Checkbox } from '$lib/components/ui/checkbox/index.js';
import type { EditContract } from './schema';
import Edit from './editContract.svelte';
import { Eye } from '@lucide/svelte';
import BigText from '$lib/components/Table/bigText.svelte';
import DeleteEntity from '$lib/components/DeleteEntity.svelte';

/**
 * Built per request rather than exported as a constant: the delete column
 * needs to know whether the viewer is a super admin, which only the page has.
 */
export const makeColumns = (canDelete = false) => [
	{
		id: 'select',
		accessorKey: 'id',
		header: ({ table }) =>
			renderComponent(Checkbox, {
				checked: table.getIsAllPageRowsSelected(),
				indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
				onCheckedChange: (value) => table.toggleAllPageRowsSelected(!!value),
				'aria-label': 'Select all'
			}),
		cell: ({ row }) =>
			renderComponent(Checkbox, {
				checked: row.getIsSelected(),
				onCheckedChange: (value) => row.toggleSelected(!!value),
				'aria-label': 'Select row'
			}),
		enableSorting: false,
		enableHiding: false
	},
	{
		id: 'index',
		header: '#',
		cell: (info) => info.table.getRowModel().rows.findIndex((r) => r.id === info.row.id) + 1
	},

	{
		accessorKey: 'editContract',
		header: 'Edit',
		sortable: true,
		cell: ({ row }) => {
			return renderComponent(Edit, {
				data: row.original
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
				name: row.original.siteName,
				link: '/dashboard/sites',

				target: '_blank'
			});
		}
	},
	{
		accessorKey: 'serviceName',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Service',
				onclick: column.getToggleSortingHandler()
			})
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
			return formatETB(info.getValue(), true);
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
			return formatETB(info.getValue(), true);
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
			return formatETB(info.getValue(), true);
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
			return formatETB(info.getValue(), true);
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
			return formatETB(info.getValue(), true);
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
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Processed By',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.addedById,
				name: row.original.processedBy, // Fallback for safety
				link: '/dashboard/admin-panel/users',
				target: '_blank'
			});
		}
	},

	{
		accessorKey: 'approvedBy',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Approved By',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.approvedById,
				name: row.original.approvedBy, // Fallback for safety
				link: '/dashboard/admin-panel/users',
				target: '_blank'
			});
		}
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
				id: row.original.paymentRequestFile,
				name: row.original.paymentRequestFile
					? 'View Request Document'
					: 'No Request Document Added', // Fallback for safety
				link: row.original.paymentRequestFile ? `/dashboard/files` : '',
				target: '_blank',
				IconComp: Eye
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
				id: row.original.withholdFile ?? '',
				name: row.original.withholdFile ? 'View Withhold Document' : 'No Withhold Document Added', // Fallback for safety
				link: `/dashboard/files`,
				target: '_blank',
				IconComp: Eye
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
				target: '_blank',
				IconComp: Eye
			});
		}
	},

	{
		id: 'delete',
		header: '',
		enableSorting: false,
		// Renders nothing unless `canDelete`; the action re-checks on the server.
		cell: ({ row }) =>
			renderComponent(DeleteEntity, {
				entity: 'Payment',
				name: `${row.original?.siteName ?? ''} ${row.original?.month ?? ''} ${row.original?.year ?? ''}`.trim(),
				id: row.original?.id,
				icon: true,
				canDelete
			})
	}
];
