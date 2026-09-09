import { renderComponent } from '$lib/components/ui/data-table/index.js';
// Assuming a new actions component
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { User } from '@lucide/svelte';
import Statuses from '$lib/components/Table/statuses.svelte';

export const columns = [
	// 1. Row Index
	{
		accessorKey: 'index',
		header: '#',
		cell: (info) => {
			const rowIndex = info.table.getRowModel().rows.findIndex((row) => row.id === info.row.id);
			return rowIndex + 1;
		}
	},
	{
		accessorKey: 'department',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Department',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},
	{
		accessorKey: 'position',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Position',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},

	{
		accessorKey: 'site',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Sites',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.siteId,
				name: row.original.site,
				link: '/dashboard/sites'
			});
		}
	},

	{
		accessorKey: 'amount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Salary',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return formatETB(info.getValue(), true);
		}
	},
	{
		accessorKey: 'housingAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Housing Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return formatETB(info.getValue(), true);
		}
	},
	{
		accessorKey: 'transportationAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Transportation Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return formatETB(info.getValue(), true);
		}
	},

	{
		accessorKey: 'positionAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Position Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return formatETB(info.getValue(), true);
		}
	},

	{
		accessorKey: 'nonTaxAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Non Tax Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return formatETB(info.getValue(), true);
		}
	},

	{
		accessorKey: 'officeCommission',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Office Commission',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return renderComponent(Statuses, {
				status: info.getValue() ? 'Yes' : 'No'
			});
		}
	},

	{
		accessorKey: 'percentage',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Non Tax Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return Number(info.getValue()) + '%';
		}
	},
	{
		accessorKey: 'startDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Start Date',
				onclick: column.getToggleSortingHandler()
			}),
		// Show 'N/A' if the payroll entry is null
		cell: (info) => formatEthiopianDate(info.getValue()) || 'Salary Not Entered',
		sortable: false // Usually not sortable
	},

	{
		accessorKey: 'endDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'End Date',
				onclick: column.getToggleSortingHandler()
			}),
		// Show 'N/A' if the payroll entry is null
		cell: (info) => formatEthiopianDate(info.getValue()) || 'Current Salary',
		sortable: false // Usually not sortable
	},

	{
		accessorKey: 'changedBy',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Changed By',
				onclick: column.getToggleSortingHandler()
			}),
		// Show 'N/A' if the payroll entry is null
		cell: ({ row }) =>
			renderComponent(DataTableLinks, {
				id: row.original.changedById,
				name: row.original.changedBy,
				link: `/dashboard/admin-panel/users`,
				target: '_blank',
				IconComp: User
			})
	}
];
