import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { hoursAndMinutes } from '$lib/attendance';
import DayCell from './DayCell.svelte';
import type { PageData } from './$types';

/** One person's month. */
type Row = PageData['rows'][number];

const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * The month grid: who, then a column per day — headed by its day of the Ethiopian month and its
 * weekday — then the month's figures. The days are columns rather than a hand-drawn table so the
 * grid keeps the table's search, department filter and export.
 */
export function monthColumns(days: string[]): ColumnDef<Row>[] {
	return [
		{
			id: 'name',
			header: 'Employee',
			accessorFn: (row) => row.name,
			cell: ({ row }) =>
				renderComponent(DataTableLinks, {
					entity: 'employee',
					id: row.original.id,
					name: row.original.name
				})
		},
		{ id: 'department', header: 'Department', accessorFn: (row) => row.department ?? '—' },
		...days.map(
			(day, i): ColumnDef<Row> => ({
				id: day,
				// Day of the Ethiopian month (the range starts on its first), and the weekday.
				header: `${i + 1} ${WEEKDAY[new Date(`${day}T00:00:00Z`).getUTCDay()]}`,
				accessorFn: (row) => row.cells[day]?.kind ?? '',
				cell: ({ row }) => renderComponent(DayCell, { day, cell: row.original.cells[day] }),
				enableSorting: false
			})
		),
		{ id: 'present', header: 'Present', accessorFn: (row) => row.present },
		{ id: 'absent', header: 'Absent', accessorFn: (row) => row.absent },
		{ id: 'excused', header: 'Excused', accessorFn: (row) => row.excused },
		{ id: 'leave', header: 'Leave', accessorFn: (row) => row.leave },
		{
			id: 'late',
			header: 'Late',
			accessorFn: (row) => row.lateMinutes,
			cell: ({ row }) =>
				row.original.late
					? `${row.original.late}× · ${hoursAndMinutes(row.original.lateMinutes)}`
					: '—'
		},
		{
			id: 'worked',
			header: 'Worked',
			accessorFn: (row) => row.workedMinutes,
			cell: ({ row }) => hoursAndMinutes(row.original.workedMinutes)
		}
	];
}
