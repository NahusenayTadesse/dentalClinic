import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { formatETB } from '$lib/global.svelte';
import type { ColumnDef } from '@tanstack/table-core';
import { Checkbox } from '$lib/components/ui/checkbox/index.js';

export const columns2 = [
	{
		id: 'index',
		header: '#',
		cell: (info) => {
			const rowIndex = info.table.getRowModel().rows.findIndex((row) => row.id === info.row.id);
			return rowIndex + 1;
		},
		enableSorting: false
	},
	// 2. Staff Name (Assumes staffName is included in the SELECT)

	{
		accessorKey: 'name',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Staff Name',
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
		accessorKey: '',
		header: 'Net Pay',
		cell: ({ row }) => {
			return formatETB(row.original.netPay, true);
		}
	},

	{
		accessorKey: 'account',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Bank Account',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => info.getValue() || 'No Account Found' // Default to UNPROCESSED if payroll entry is missing
	},

	{
		accessorKey: 'bank',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Bank',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => info.getValue() || 'Account Not Found' // Default to UNPROCESSED if payroll entry is missing
	}
];

export const columns = [
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
		cell: (info) => {
			const rowIndex = info.table.getRowModel().rows.findIndex((row) => row.id === info.row.id);
			return rowIndex + 1;
		},
		enableSorting: false
	},
	// 2. Staff Name (Assumes staffName is included in the SELECT)

	{
		accessorKey: 'name',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Staff Name',
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

	// 3. Position (Assumes staffPosition is included in the SELECT)
	{
		accessorKey: 'department',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Department',
				onclick: column.getToggleSortingHandler()
			})
	},
	{
		accessorKey: 'position',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Position',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'site',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Site',
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
		cell: ({ row }) => {
			return formatETB(row.original.basicSalary);
		}
	},

	{
		accessorKey: 'commission',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Commission',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return formatETB(row.original.commission);
		}
	},

	{
		accessorKey: 'overtime',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Over Time',
				onclick: column.getToggleSortingHandler()
			}),
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
		cell: ({ row }) => {
			return formatETB(row.original.gross, true);
		}
	},

	{
		accessorKey: 'absent',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Absent',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return row.original.absent ? row.original.absent : 0;
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
			// const missingDays = Number(row.original.absentDays);
			// const totalPay = Number(row.original.basicSalary);

			// const amount = missingDays * (totalPay / 30);

			return formatETB(row.original.attendancePenality, true);
		}
	},

	{
		id: 'penEm',
		accessorKey: 'penEm',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Pen (Em) (0.7)',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return formatETB(row.original.penEm, true);
		}
	},
	{
		id: 'penOrg',
		accessorKey: 'penOrgAmount',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Pen (Org) (0.11)',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return formatETB(row.original.penOrg, true);
		}
	},

	// {
	// 	id: 'tax',
	// 	accessorKey: '',
	// 	header: ({ column }) =>
	// 		renderComponent(DataTableSort, {
	// 			name: 'Tax',
	// 			onclick: column.getToggleSortingHandler()
	// 		}),
	// 	cell: ({ row }) => {
	// 		const taxableIncome = Number(Number(row.original.gross) - Number(row.original.nonTaxable));
	// 		const tax = calculateTax(taxableIncome, types);

	// 		return formatETB(tax, true);
	// 	}
	// },

	{
		accessorKey: 'taxable',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Taxable Salary',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return formatETB(row.original.taxable, true);
		}
	},
	{
		id: 'taxAmount',
		accessorKey: '',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Salary Tax',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return formatETB(row.original.taxAmount, true);
		}
	},

	{
		accessorKey: '',
		header: 'Net Pay',
		cell: ({ row }) => {
			return formatETB(row.original.netPay, true);
		}
	},

	{
		accessorKey: 'account',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Bank Account',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => info.getValue() || 'No Account Found' // Default to UNPROCESSED if payroll entry is missing
	},

	{
		accessorKey: 'bank',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Bank',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => info.getValue() || 'Account Not Found' // Default to UNPROCESSED if payroll entry is missing
	}
];
