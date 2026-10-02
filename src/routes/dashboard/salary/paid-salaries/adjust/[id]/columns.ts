import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';

export const adjustmentColumns = [
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
				name: 'Employee Name',
				onclick: column.getToggleSortingHandler()
			}),
		// Using DataTableLinks to view staff profile
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.id,
				name: row.original.name || 'N/A', // Fallback for safety
				link: '/dashboard/salary/single'
			});
		}
	},
	{
		accessorKey: 'adjustmentType',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Adjustment Type',
				onclick: column.getToggleSortingHandler()
			})
	},
	{
		accessorKey: 'basicSalary',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Basic Salary',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'commissionAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Commission',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'overtimeAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Over Time',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'bonusAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Bonus',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'deductions',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Deduction',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'allowances',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Allowances',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'transportAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Transport Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'positionAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Position Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'housingAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Housing Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'nonTaxableAllowance',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Non-Taxable',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'grossAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Gross Amount',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'netAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Net Amount',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'amount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Amount',
				onclick: column.getToggleSortingHandler()
			}),

		cell: (info) => formatETB(info.getValue(), true)
	},
	{
		accessorKey: 'transaction',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Full Transaction Link',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.transactionId,
				name: 'View Transaction', // Fallback for safety
				link: '/dashboard/salary/transaction',
				target: '_blank'
			});
		}
	},
	{
		accessorKey: 'reason',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Reason',
				onclick: column.getToggleSortingHandler()
			})
	},
	{
		accessorKey: 'recieptLink',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Bank Statement',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.recieptLink,
				name: 'View Bank Statement', // Fallback for safety
				link: '/dashboard/files',
				target: '_blank'
			});
		}
	},

	{
		accessorKey: 'createdAt',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Created At',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatEthiopianDate(info.getValue())
	},
	{
		accessorKey: 'addedBy',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Created By',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.createdById,
				name: row.original.addedBy, // Fallback for safety
				entity: 'user',
				target: '_blank'
			});
		}
	}
];
