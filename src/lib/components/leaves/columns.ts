import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DeleteEntity from '$lib/components/DeleteEntity.svelte';
// Assuming a new actions component
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import { Checkbox } from '@nahu/admin-kit/components/ui/checkbox/index.js';
import Edit from '$lib/components/leaves/edit.svelte';
import { Eye, X } from '@lucide/svelte';
import { formatDays } from '$lib/leaveDays';
import type { ColumnDef } from '@tanstack/table-core';
import type { LeaveStatus } from './schema';

/**
 * The row shape these columns read. Declared here rather than derived from one page's
 * `PageData`, because three pages share this file and their selects differ slightly.
 *
 * `addedBy`/`addedById` are optional: only the pending list joins the person who entered the
 * leave, and only the pending list renders them.
 */
export type LeaveRow = {
	id: number;
	staffId: number;
	name: string;
	department: string | null;
	branchName: string | null;
	requestDate: string | Date;
	startDate: string | Date;
	endDate: string | Date;
	leaveTypeName: string | null;
	reason: string | null;
	rejectionReason: string | null;
	leaveLetter: string | null;
	numberOfDays: number | string | null;
	approvedBy: string | null;
	approvedById: string | null;
	addedBy?: string | null;
	addedById?: string | null;
};

// NOTE: You must ensure your backend query includes 'name' and 'position'
// from the staff table to display them here!
// e.g., staffName: staff.name, staffPosition: staff.category

/**
 * Built per request rather than exported as a constant: the delete column needs to know whether
 * the viewer is a super admin, and the column set depends on which state the page lists — which
 * only the page knows.
 *
 * The two axes that vary, and nothing else:
 *   - `pending` has no approver yet, so it credits whoever *entered* the leave.
 *   - only `rejected` has a rejection reason to show.
 *
 * These were three near-identical files; the difference between them was 20 lines out of 224.
 */
export const makeColumns = (status: LeaveStatus, canDelete = false): ColumnDef<LeaveRow>[] => [
	// 1. Row Index

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
		accessorKey: 'index',
		header: '#',
		cell: (info) => {
			const rowIndex = info.table.getRowModel().rows.findIndex((row) => row.id === info.row.id);
			return rowIndex + 1;
		}
	},
	{
		accessorKey: 'editContract',
		header: 'Edit',
		cell: ({ row }) => {
			return renderComponent(Edit, {
				data: row.original
			});
		}
	},

	{
		accessorKey: 'name',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Name',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.staffId,
				name: row.original.name,
				entity: 'employee'
			});
		}
	},

	{
		accessorKey: 'department',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Department',
				onclick: column.getToggleSortingHandler()
			})
	},

	{
		accessorKey: 'branchName',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Branches',
				onclick: column.getToggleSortingHandler()
			})
	},
	{
		accessorKey: 'requestDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Request Date',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => formatEthiopianDate(info.getValue<Date>())
	},

	{
		accessorKey: 'startDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Start Date',
				onclick: column.getToggleSortingHandler()
			}),
		// Show 'N/A' if the payroll entry is null
		cell: (info) => formatEthiopianDate(info.getValue<Date>()) || 'Leave Not Entered',
		enableSorting: false // Usually not sortable
	},

	{
		accessorKey: 'endDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'End Date',
				onclick: column.getToggleSortingHandler()
			}),
		// Show 'N/A' if the payroll entry is null
		cell: (info) => formatEthiopianDate(info.getValue<Date>()) || 'Leave Not Entered',
		enableSorting: false // Usually not sortable
	},

	{
		accessorKey: 'numberOfDays',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Number of Days',
				onclick: column.getToggleSortingHandler()
			}),
		// Show 'N/A' if the payroll entry is null
		cell: (info) => formatDays(info.getValue() as number),
		enableSorting: false // Usually not sortable
	},

	{
		accessorKey: 'leaveTypeName',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Leave Type',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => info.getValue() ?? 'Not Set'
	},

	{
		accessorKey: 'reason',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Reason',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return info.getValue();
		}
	},
	...(status === 'rejected'
		? ([
				{
					accessorKey: 'rejectionReason',
					header: ({ column }) =>
						renderComponent(DataTableSort, {
							name: 'Rejection Reason',
							onclick: column.getToggleSortingHandler()
						}),
					cell: (info) => info.getValue()
				}
			] as ColumnDef<LeaveRow>[])
		: []),

	{
		accessorKey: 'leaveLetter',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Leave Letter',
				onclick: column.getToggleSortingHandler()
			}),
		cell: (info) => {
			return renderComponent(DataTableLinks, {
				id: info.getValue<string | null>(),
				name: info.getValue() ? `View Leave Letter` : 'Leave Letter Not Entered',
				link: '/dashboard/files',
				IconComp: info.getValue() ? Eye : X,
				target: '_blank'
			});
		}
	},
	{
		accessorKey: status === 'pending' ? 'addedBy' : 'approvedBy',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: status === 'pending' ? 'Added By' : 'Approved By',
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			// Use staffId for the link, but ensure staffName is selected in the query
			return renderComponent(DataTableLinks, {
				id: (status === 'pending' ? row.original.addedById : row.original.approvedById) ?? null,
				name: (status === 'pending' ? row.original.addedBy : row.original.approvedBy) ?? null,
				entity: 'user',
				target: '_blank'
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
				entity: 'Leave Request',
				name: `${row.original?.name ?? ''} ${row.original?.leaveTypeName ?? ''}`.trim(),
				id: row.original?.id,
				icon: true,
				canDelete
			})
	}
];
