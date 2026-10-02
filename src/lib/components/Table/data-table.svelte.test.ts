import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ComponentProps } from 'svelte';
import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
import DataTable from './data-table.svelte';
import DataTableSort from './data-table-sort.svelte';

type Row = { id: number; name: string; amount: number };

const rows: Row[] = [
	{ id: 1, name: 'Alice', amount: 300 },
	{ id: 2, name: 'Bob', amount: 100 },
	{ id: 3, name: 'Charlie', amount: 200 }
];

const columns: ColumnDef<Row, unknown>[] = [
	{ accessorKey: 'name', header: 'Name' },
	{
		accessorKey: 'amount',
		header: ({ column }) =>
			renderComponent(DataTableSort, { name: 'Amount', onclick: column.getToggleSortingHandler() })
	}
];

// More rows than the default page size, so paging is real rather than theoretical.
const manyRows: Row[] = Array.from({ length: 25 }, (_, i) => ({
	id: i + 1,
	name: `Row ${i + 1}`,
	amount: (i + 1) * 10
}));

/** Rows with a column worth faceting, for the filter and chart tests. */
type Staff = { id: number; name: string; department: string };

const staff: Staff[] = [
	{ id: 1, name: 'Abebe', department: 'Reception' },
	{ id: 2, name: 'Kidist', department: 'Clinical' },
	{ id: 3, name: 'Marta', department: 'Clinical' },
	{ id: 4, name: 'Samuel', department: 'Clinical' }
];

const staffColumns: ColumnDef<Staff, unknown>[] = [
	{ accessorKey: 'name', header: 'Name' },
	{ accessorKey: 'department', header: 'Department' }
];

/**
 * `render` cannot infer a generic component's type parameters, so every direct call reported
 * `ColumnDef<Row>` as unassignable to `ColumnDef<unknown>` — eleven errors describing the test
 * harness rather than the component. One wrapper carries the row type through instead.
 */
async function renderTable<T>(props: {
	data: T[];
	columns: ColumnDef<T, unknown>[];
	defaultPageSize?: number;
	height?: string;
	charts?: boolean;
	facetKeys?: string[];
	facetLabels?: Record<string, string>;
	fileName?: string;
	server?: {
		pagination: { page: number; pageSize: number; total: number };
		facets?: Record<string, { value: string; label: string; count: number }[]>;
		filters?: Record<string, string | null | undefined>;
	};
}) {
	return render(DataTable, props as ComponentProps<typeof DataTable>);
}

describe('data-table.svelte', () => {
	it('renders a header per column and a row per data item', async () => {
		const screen = await renderTable({ data: rows, columns });

		await expect.element(page.getByRole('cell', { name: 'Alice' })).toBeInTheDocument();
		await expect.element(page.getByRole('cell', { name: 'Bob' })).toBeInTheDocument();
		await expect.element(page.getByRole('cell', { name: 'Charlie' })).toBeInTheDocument();
		expect(screen.container.textContent).toContain('Name');
	});

	it('shows the empty state when there is no data', async () => {
		await renderTable({ data: [], columns });

		await expect.element(page.getByText('Nothing found here.')).toBeInTheDocument();
	});

	it('filters rows by the global search box', async () => {
		await renderTable({ data: rows, columns });

		await userEvent.fill(page.getByPlaceholder('Search Table...'), 'Bob');

		await expect.element(page.getByRole('cell', { name: 'Bob' })).toBeInTheDocument();
		await expect.element(page.getByRole('cell', { name: 'Alice' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('cell', { name: 'Charlie' })).not.toBeInTheDocument();
	});

	it('hides a column when it is unchecked from the "Columns" menu', async () => {
		const screen = await renderTable({ data: rows, columns });

		expect(screen.container.textContent).toContain('Name');

		await userEvent.click(page.getByRole('button', { name: 'Columns' }));
		await userEvent.click(page.getByRole('menuitemcheckbox', { name: 'name' }));

		await expect.poll(() => screen.container.textContent).not.toContain('Alice');
	});

	it('sorts rows when a sortable column header is clicked (desc, then asc)', async () => {
		await renderTable({ data: rows, columns });

		// Unsorted: insertion order, Alice (300) first.
		await expect.element(page.getByRole('row').nth(1)).toMatchTextContent('Alice');

		await userEvent.click(page.getByRole('button', { name: 'Amount' }));
		// TanStack's default toggle cycle starts descending: Alice (300) stays first.
		await expect.element(page.getByRole('row').nth(1)).toMatchTextContent('Alice');
		await expect.element(page.getByRole('row').nth(3)).toMatchTextContent('Bob');

		await userEvent.click(page.getByRole('button', { name: 'Amount' }));
		// Second click: ascending, Bob (100) first.
		await expect.element(page.getByRole('row').nth(1)).toMatchTextContent('Bob');
	});

	/*
	 * Rewritten when the table stopped defaulting to `pageSize: data.length`. The previous version
	 * asserted that twelve rows produced no pager — which was the bug: every table put every row
	 * into the DOM and the pager never appeared.
	 */
	it('paginates client-side at the default page size', async () => {
		await renderTable({ data: manyRows, columns, defaultPageSize: 10 });

		await expect
			.element(page.getByRole('cell', { name: 'Row 1', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('cell', { name: 'Row 11', exact: true }))
			.not.toBeInTheDocument();

		// The count is the whole set, not the page — that distinction is the point of the rewrite.
		await expect.element(page.getByRole('button', { name: /25 Results/ })).toBeInTheDocument();

		await userEvent.click(page.getByRole('button', { name: 'Next page' }));
		await expect
			.element(page.getByRole('cell', { name: 'Row 11', exact: true }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Previous page' })).toBeEnabled();
	});

	it('counts facets over every row and filters on one', async () => {
		await renderTable({
			data: staff,
			columns: staffColumns,
			facetKeys: ['department'],
			facetLabels: { department: 'Department' }
		});

		await userEvent.click(page.getByRole('button', { name: 'Filter by Department' }));

		// Targeted by role: "Clinical" is also the text of three table cells, and the popover's
		// Command.Item is the only one of them that is an option.
		const clinical = page.getByRole('option', { name: /Clinical/ });

		// Three clinical, one reception — counted off all four rows, not off the page.
		await expect.element(clinical).toBeInTheDocument();
		await expect.element(clinical).toMatchTextContent('3');

		await userEvent.click(clinical);
		await expect.element(page.getByRole('cell', { name: 'Abebe' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('cell', { name: 'Kidist' })).toBeInTheDocument();
	});

	/*
	 * The bug this component was built to end: a server-paginated page handed its facet menu one
	 * page of rows, which then counted them and presented the tally as the whole result set.
	 * In server mode the tally must come from the server and must not be derived from `data`.
	 */
	it('uses the server facet tally, never the page it was handed', async () => {
		await renderTable({
			data: staff.slice(0, 2), // one "page" of a much larger result
			columns: staffColumns,
			facetKeys: ['department'],
			facetLabels: { department: 'Department' },
			server: {
				pagination: { page: 1, pageSize: 2, total: 400 },
				// `value` is what the filter sends, `label` is what the reader sees. On a foreign key
				// they differ — tallying by name alone broke every FK facet in the app.
				facets: {
					department: [
						{ value: '902', label: 'Clinical', count: 310 },
						{ value: '901', label: 'Reception', count: 90 }
					]
				}
			}
		});

		await expect.element(page.getByRole('button', { name: /400 Results/ })).toBeInTheDocument();

		await userEvent.click(page.getByRole('button', { name: 'Filter by Department' }));
		await expect.element(page.getByText('310')).toBeInTheDocument();
		await expect.element(page.getByText('90')).toBeInTheDocument();
	});

	/*
	 * The bug this shape exists to prevent. Facets used to be a plain {name: count} map, so the
	 * name went into the URL: clicking "Piassa Clinic" wrote `branchId=Piassa+Clinic`, the server
	 * did `Number(...)` on it, and the page came back with no table at all.
	 */
	it('sends the facet value, not the label the reader sees', async () => {
		await renderTable({
			data: staff.slice(0, 2),
			columns: staffColumns,
			facetKeys: ['department'],
			facetLabels: { department: 'Department' },
			server: {
				pagination: { page: 1, pageSize: 2, total: 400 },
				facets: { department: [{ value: '902', label: 'Clinical', count: 310 }] }
			}
		});

		await userEvent.click(page.getByRole('button', { name: 'Filter by Department' }));

		const option = page.getByRole('option', { name: /Clinical/ });
		await expect.element(option).toBeInTheDocument();
		// The id never reaches the screen; the name never reaches the URL.
		await expect.element(option).not.toMatchTextContent('902');
	});

	it('shows no facets in server mode when the server computed none', async () => {
		const screen = await renderTable({
			data: staff.slice(0, 2),
			columns: staffColumns,
			facetKeys: ['department'],
			server: { pagination: { page: 1, pageSize: 2, total: 400 } }
		});

		// Silence beats a tally of two rows labelled as four hundred.
		expect(screen.container.querySelector('[aria-label="Filter by department"]')).toBeNull();
	});

	it('does not re-slice rows the server already paged', async () => {
		await renderTable({
			data: manyRows.slice(10, 20), // page two, handed to us whole
			columns,
			server: { pagination: { page: 2, pageSize: 10, total: 25 } }
		});

		await expect
			.element(page.getByRole('cell', { name: 'Row 11', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('cell', { name: 'Row 20', exact: true }))
			.toBeInTheDocument();
	});

	/*
	 * The body used to be capped at `max-h-[45vh]` while the page scrolled past it, so half the
	 * window sat empty and the rows had their own small scrollbar inside it. The table now claims
	 * a height and divides it between the toolbar, the rows and the pager.
	 *
	 * Only the declared height is asserted, not the flex behaviour that divides it: these browser
	 * tests load no stylesheet, so every Tailwind utility is absent and every element computes as
	 * `display: block`. A layout assertion here would pass or fail for reasons unrelated to the
	 * layout. The height is an inline style, so it is real either way.
	 */
	/*
	 * The chart used to sit in a pane beside the table, which narrowed every column permanently to
	 * make room for something most readers were not looking at — on the employees list it clipped
	 * the status column outright. It is a toggle now, and it opens above the rows rather than
	 * beside them, so opening it never hides a column.
	 */
	it('keeps the chart closed until asked, then opens it above the rows', async () => {
		const screen = await renderTable({
			data: staff,
			columns: staffColumns,
			facetKeys: ['department'],
			charts: true
		});

		expect(screen.container.querySelector('canvas'), 'closed by default').toBeNull();

		const toggle = page.getByRole('button', { name: 'Charts' });
		await expect.element(toggle).toBeInTheDocument();
		await userEvent.click(toggle);

		const canvas = screen.container.querySelector('canvas');
		expect(canvas, 'opens on click').not.toBeNull();

		// Above the rows: the panel must precede the table in document order, never sit beside it.
		const table = screen.container.querySelector('table');
		expect(canvas!.compareDocumentPosition(table!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('offers no chart button when the page asked for none', async () => {
		await renderTable({ data: staff, columns: staffColumns, facetKeys: ['department'] });

		await expect.element(page.getByRole('button', { name: 'Charts' })).not.toBeInTheDocument();
	});

	it('takes the height it is given', async () => {
		const screen = await renderTable({ data: manyRows, columns, height: '400px' });

		const frame = screen.container.querySelector('[data-testid="table-frame"]');
		expect(frame?.getAttribute('style')).toContain('height: 400px');
		expect((frame as HTMLElement).clientHeight).toBe(400);
	});

	it('defaults to 80vh rather than a fixed row area', async () => {
		const screen = await renderTable({ data: manyRows, columns });

		const frame = screen.container.querySelector('[data-testid="table-frame"]');
		expect(frame?.getAttribute('style')).toContain('height: 80vh');
	});

	it('offers Print and Export to CSV actions in the export menu', async () => {
		const screen = await renderTable({ data: rows, columns, fileName: 'MyReport' });

		// The export trigger is icon-only (no accessible name), so `name: ''` isn't a
		// usable filter for getByRole (Playwright treats an empty name as "no filter").
		// It's the only button rendering the lucide "download" icon, so target it directly.
		const exportTrigger = screen.container.querySelector(
			'button:has(svg.lucide-download)'
		) as HTMLButtonElement;
		exportTrigger.click();

		await expect.element(page.getByText('Print')).toBeInTheDocument();
		await expect.element(page.getByText('Export to CSV')).toBeInTheDocument();
	});
});
