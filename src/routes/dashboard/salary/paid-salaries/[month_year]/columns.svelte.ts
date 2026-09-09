import type { ColumnDef } from '@tanstack/table-core';
import type { PageData } from './$types';

/** One row of the table this file describes, taken from the load so the two cannot drift. */
type RowData = NonNullable<PageData['payrollReciept']>[number];

import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
import { Link } from '@lucide/svelte';

export const columns: ColumnDef<RowData>[] = [
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
		accessorKey: '',
		header: 'Net Pay',
		cell: ({ row }) => {
			// const missingDays = Number(row.original.absentDays);
			// const salary = Number(row.original.basicSalary);

			// const amount = missingDays * (salary / 30);

			// const totalPay = Number(row.original.gross);

			// const taxableIncome = Number(Number(row.original.gross) - Number(row.original.nonTaxable));
			// const tax = calculateTax(taxableIncome, types);

			// const penalityAmount = missingDays * (totalPay / 30);
			// const total = totalPay - (penalityAmount + Number(tax));

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
		cell: (info) => info.getValue() || 'Account Not Found' // Default to UNPROCESSED if payroll entry is missing
	}
];

export const reciepts = [
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
	// 2. Staff Name (Assumes staffName is included in the SELECT)
	{
		accessorKey: 'numberOfEmployees',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'No of Employees',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => info.getValue() + ' Employees'
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
		accessorKey: 'paidDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Amount',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatEthiopianDate(info.getValue())
	},
	{
		accessorKey: 'payPeriodStart',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Start Date',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatEthiopianDate(info.getValue())
	},
	{
		accessorKey: 'payPeriodEnd',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'End Date',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatEthiopianDate(info.getValue())
	},
	{
		accessorKey: 'recieptLink',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Bank Statement',
				onclick: column.getToggleSortingHandler()
			}),
		// Using DataTableLinks to view staff profile
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
		accessorKey: 'uploadedBy',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Paying Officer',
				onclick: column.getToggleSortingHandler()
			}),
		// Using DataTableLinks to view staff profile
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: row.original.uploadedById,
				name: row.original.uploadedBy, // Fallback for safety
				link: '/dashboard/admin-panel/user',
				target: '_blank'
			});
		}
	}
];

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
		accessorKey: 'seeDetails',
		header: 'Details',
		cell: ({ row }) => {
			return renderComponent(DataTableLinks, {
				id: row.original.transactionId,
				name: 'View Details',
				link: '/dashboard/salary/paid-salaries/adjust',
				IconComp: Link
			});
		}
	},
	{
		accessorKey: 'count',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Number of Employees',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => info.getValue() + ' Employees'
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
				link: '/dashboard/admin-panel/user',
				target: '_blank'
			});
		}
	}
];
