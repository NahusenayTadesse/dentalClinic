import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import Statuses from '$lib/components/Table/statuses.svelte';
import Copy from '$lib/Copy.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatEthiopianDate } from '$lib/global.svelte';
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
		header: 'Month',
		cell: ({ row }) => row.original.month
	},

	{
		accessorKey: 'year',
		header: 'Year',
		cell: ({ row }) => row.original.year
	},

	{
		accessorKey: 'paymentAmount',
		header: 'Total Paid',
		cell: ({ row }) => {
			const amount = parseFloat(row.original.paymentAmount);
			return new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB' }).format(amount);
		}
	},

	{
		accessorKey: 'invoiceNumber',
		header: 'Invoice #',
		cell: ({ row }) => renderComponent(Copy, { data: row.original.invoiceNumber })
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
