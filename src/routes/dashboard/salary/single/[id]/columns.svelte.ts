import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';

export const columns = [
	// 1. Row Index
	//

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
		accessorKey: 'month',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Month',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			return row.original.month;
		}
	},

	{
		accessorKey: 'year',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Year',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			return row.original.year;
		}
	},

	{
		id: 2,
		accessorKey: 'netPay',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Net Pay',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return formatETB(row.original.netPay, true);
		}
	},

	{
		accessorKey: 'basicSalary',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Basic Salary',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			return formatETB(row.original.basicSalary);
		}
	},

	{
		accessorKey: 'overtime',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Over Time',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			return formatETB(row.original.overtime);
		}
	},

	{
		accessorKey: 'transport',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Transport Allowance',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			return formatETB(row.original.transportAllowance, true);
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
		cell: ({ row }) => {
			return formatETB(row.original.positionAllowance, true);
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
		cell: ({ row }) => {
			return formatETB(row.original.housingAllowance, true);
		}
	},

	{
		accessorKey: 'nonTaxable',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Non-Taxable',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			return formatETB(row.original.nonTaxable, true);
		}
	},

	{
		accessorKey: 'gross',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Gross Salary',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: ({ row }) => {
			return formatETB(row.original.gross, true);
		}
	},

	{
		id: 'penality',
		accessorKey: '',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Attendance Penality',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return formatETB(row.original.attendancePenality, true);
		}
	},

	{
		id: 'taxAmount',
		accessorKey: '',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Tax',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return formatETB(row.original.taxAmount, true);
		}
	},

	{
		accessorKey: 'netPay',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Net Pay',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return formatETB(row.original.netPay, true);
		}
	},

	{
		accessorKey: 'bank',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Bank',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => info.getValue() || 'Account Not Found' // Default to UNPROCESSED if payroll entry is missing
	}
];
