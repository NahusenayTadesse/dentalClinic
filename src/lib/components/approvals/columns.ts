import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTableSort from '$lib/components/Table/data-table-sort.svelte';
import DataTableLinks from '$lib/components/Table/data-table-links.svelte';
import { Checkbox } from '@nahu/admin-kit/components/ui/checkbox/index.js';
import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
import { Building2, CircleUser, UserRound, Users } from '@lucide/svelte';

/** Declared server-side in `$lib/server/approvals.ts` and sent down with the load. */
type Link = { idKey: string; href: string };

/** A glance at the icon says what kind of record the link opens. */
const ICONS: Record<string, typeof UserRound> = {
	'/dashboard/employees/single': UserRound,
	'/dashboard/customers': Users,
	'/dashboard/branches': Building2,
	'/dashboard/admin-panel/users': CircleUser
};

/** Turns a registry key into a readable header: `contractAmount` -> `Contract Amount`. */
function humanise(key: string): string {
	return key
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/^./, (c) => c.toUpperCase())
		.replace(/\bId No\b/, 'ID No');
}

/**
 * Formatting is inferred from the column name rather than declared per entity, so the registry
 * stays a plain list of fields. Amount-ish names render as birr, date-ish names as dates.
 */
function cellFor(key: string) {
	if (/amount|salary|gross|net|total/i.test(key)) {
		return (info: { getValue: () => unknown }) => {
			const v = info.getValue();
			return v === null || v === undefined ? '—' : formatETB(Number(v), true);
		};
	}

	if (/date$/i.test(key)) {
		return (info: { getValue: () => unknown }) => {
			const v = info.getValue();
			if (!v) return '—';

			const d = new Date(String(v));
			if (!Number.isNaN(d.getTime())) return formatEthiopianDate(d);

			// MySQL zero dates (`0000-00-00`) survive as an unparseable Date and
			// used to print the words "Invalid Date" across the column. An empty
			// cell reads the same as every other missing value.
			const raw = String(v);
			return raw === 'Invalid Date' || raw.startsWith('0000-00-00') ? '—' : raw;
		};
	}

	return (info: { getValue: () => unknown }) => {
		const v = info.getValue();
		return v === null || v === undefined || v === '' ? '—' : String(v);
	};
}

/** These are rendered by the fixed columns below, not as summary fields. */
const RESERVED = new Set([
	'id',
	'requestedBy',
	'requestedByName',
	'createdAt',
	'rejectedByName',
	'rejectedAt',
	'rejectionReason'
]);

/**
 * A cell that opens the record it names. Falls back to plain text when the
 * relation is empty — a contract with no signing officer should read "—", not
 * offer a link to nowhere.
 */
function linkCell(nameKey: string, link: Link) {
	return ({ row }: { row: any }) => {
		const id = row.original[link.idKey];
		const name = row.original[nameKey];

		if (id === null || id === undefined || id === '' || !name) return name ? String(name) : '—';

		return renderComponent(DataTableLinks, {
			id: String(id),
			name: String(name),
			link: link.href,
			IconComp: ICONS[link.href]
		});
	};
}

export function makeColumns(
	sample: Record<string, unknown> | undefined,
	links: Record<string, Link> = {},
	/** The rejected queue carries three more columns: why, by whom, and when. */
	rejected = false
) {
	// The id a link travels on is not a column of its own — nobody reads a queue
	// to find out that a branch contract points at branch 47.
	const linkIdKeys = new Set(Object.values(links).map((l) => l.idKey));

	const summaryKeys = Object.keys(sample ?? {}).filter(
		(k) => !RESERVED.has(k) && !linkIdKeys.has(k)
	);

	return [
		{
			id: 'select',
			accessorKey: 'id',
			header: ({ table }: { table: any }) =>
				renderComponent(Checkbox, {
					checked: table.getIsAllPageRowsSelected(),
					indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
					onCheckedChange: (value: boolean) => table.toggleAllPageRowsSelected(!!value),
					'aria-label': 'Select all'
				}),
			cell: ({ row }: { row: any }) =>
				renderComponent(Checkbox, {
					checked: row.getIsSelected(),
					onCheckedChange: (value: boolean) => row.toggleSelected(!!value),
					'aria-label': 'Select row'
				}),
			enableSorting: false,
			enableHiding: false
		},
		{
			accessorKey: 'index',
			header: '#',
			cell: (info: any) =>
				info.table.getRowModel().rows.findIndex((r: any) => r.id === info.row.id) + 1
		},

		...summaryKeys.map((key) => ({
			accessorKey: key,
			header: ({ column }: { column: any }) =>
				renderComponent(DataTableSort, {
					name: humanise(key),
					onclick: column.getToggleSortingHandler()
				}),
			cell: links[key] ? linkCell(key, links[key]) : cellFor(key)
		})),

		{
			accessorKey: 'requestedByName',
			header: ({ column }: { column: any }) =>
				renderComponent(DataTableSort, {
					name: 'Requested By',
					onclick: column.getToggleSortingHandler()
				}),
			cell: links.requestedByName
				? linkCell('requestedByName', links.requestedByName)
				: (info: any) => info.getValue() ?? 'Unknown'
		},
		{
			accessorKey: 'createdAt',
			header: ({ column }: { column: any }) =>
				renderComponent(DataTableSort, {
					name: 'Requested On',
					onclick: column.getToggleSortingHandler()
				}),
			cell: (info: any) => {
				const v = info.getValue();
				return v ? formatEthiopianDate(new Date(String(v))) : '—';
			}
		},

		...(rejected
			? [
					{
						accessorKey: 'rejectionReason',
						header: 'Reason',
						cell: (info: any) => info.getValue() || 'No reason recorded'
					},
					{
						accessorKey: 'rejectedByName',
						header: ({ column }: { column: any }) =>
							renderComponent(DataTableSort, {
								name: 'Rejected By',
								onclick: column.getToggleSortingHandler()
							}),
						cell: (info: any) => info.getValue() ?? 'Unknown'
					},
					{
						accessorKey: 'rejectedAt',
						header: ({ column }: { column: any }) =>
							renderComponent(DataTableSort, {
								name: 'Rejected On',
								onclick: column.getToggleSortingHandler()
							}),
						cell: (info: any) => {
							const v = info.getValue();
							return v ? formatEthiopianDate(new Date(String(v))) : '—';
						}
					}
				]
			: [])
	];
}
