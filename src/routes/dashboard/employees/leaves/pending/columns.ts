import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DeleteEntity from '$lib/components/DeleteEntity.svelte';
// Assuming a new actions component
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import { Checkbox } from '$lib/components/ui/checkbox/index.js';
import Edit from './edit.svelte';
import { Eye, X } from '@lucide/svelte';
import { formatDays } from '$lib/leaveDays';

// NOTE: You must ensure your backend query includes 'name' and 'position'
// from the staff table to display them here!
// e.g., staffName: staff.name, staffPosition: staff.category

/**
 * Built per request rather than exported as a constant: the delete column
 * needs to know whether the viewer is a super admin, which only the page has.
 */
export const makeColumns = (canDelete = false) => [
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
		sortable: true,
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
		sortable: true,
		cell: ({ row }) => {
			// You can pass whatever you need from `row.original` to the component
			return renderComponent(DataTableLinks, {
				id: row.original.staffId,
				name: row.original.name,
				link: '/dashboard/employees/single'
			});
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
		accessorKey: 'siteName',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Sites',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true
	},
	{
		accessorKey: 'requestDate',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Request Date',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return formatEthiopianDate(info.getValue());
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
		cell: (info) => formatEthiopianDate(info.getValue()) || 'Leave Not Entered',
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
		cell: (info) => formatEthiopianDate(info.getValue()) || 'Leave Not Entered',
		sortable: false // Usually not sortable
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
		sortable: false // Usually not sortable
	},

	{
		accessorKey: 'leaveTypeName',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Leave Type',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => info.getValue() ?? 'Not Set'
	},

	{
		accessorKey: 'reason',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Reason',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return info.getValue();
		}
	},

	{
		accessorKey: 'leaveLetter',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				name: 'Leave Letter',
				onclick: column.getToggleSortingHandler()
			}),
		sortable: true,
		cell: (info) => {
			return renderComponent(DataTableLinks, {
				id: info.getValue(),
				name: info.getValue() ? `View Leave Letter` : 'Leave Letter Not Entered',
				link: '/dashboard/files',
				IconComp: info.getValue() ? Eye : X,
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
				id: row.original.addedById,
				name: row.original.addedBy, // Fallback for safety
				link: '/dashboard/admin-panel/users',
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
				name: `${row.original?.name ?? ''} ${row.original?.leaveType ?? ''}`.trim(),
				id: row.original?.id,
				icon: true,
				canDelete
			})
	}
];
