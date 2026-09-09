import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '$lib/components/ui/data-table/index.js';
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

// 12 rows so the "Pages" dropdown offers a size smaller than the full set
// (getTableBreakpoints only ever offers multiples of 10 plus the total count).
const manyRows: Row[] = Array.from({ length: 12 }, (_, i) => ({
	id: i + 1,
	name: `Row ${i + 1}`,
	amount: (i + 1) * 10
}));

describe('data-table.svelte', () => {
	it('renders a header per column and a row per data item', async () => {
		const screen = render(DataTable, { data: rows, columns });

		await expect.element(page.getByRole('cell', { name: 'Alice' })).toBeInTheDocument();
		await expect.element(page.getByRole('cell', { name: 'Bob' })).toBeInTheDocument();
		await expect.element(page.getByRole('cell', { name: 'Charlie' })).toBeInTheDocument();
		expect(screen.container.textContent).toContain('Name');
	});

	it('shows the empty state when there is no data', async () => {
		render(DataTable, { data: [], columns });

		await expect.element(page.getByText('Nothing found here.')).toBeInTheDocument();
	});

	it('filters rows by the global search box', async () => {
		render(DataTable, { data: rows, columns });

		await userEvent.fill(page.getByPlaceholder('Search Table...'), 'Bob');

		await expect.element(page.getByRole('cell', { name: 'Bob' })).toBeInTheDocument();
		await expect.element(page.getByRole('cell', { name: 'Alice' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('cell', { name: 'Charlie' })).not.toBeInTheDocument();
	});

	it('hides a column when it is unchecked from the "Columns" menu', async () => {
		const screen = render(DataTable, { data: rows, columns });

		expect(screen.container.textContent).toContain('Name');

		await userEvent.click(page.getByRole('button', { name: 'Columns' }));
		await userEvent.click(page.getByRole('menuitemcheckbox', { name: 'name' }));

		await expect.poll(() => screen.container.textContent).not.toContain('Alice');
	});

	it('sorts rows when a sortable column header is clicked (desc, then asc)', async () => {
		render(DataTable, { data: rows, columns });

		// Unsorted: insertion order, Alice (300) first.
		await expect.element(page.getByRole('row').nth(1)).toHaveTextContent('Alice');

		await userEvent.click(page.getByRole('button', { name: 'Amount' }));
		// TanStack's default toggle cycle starts descending: Alice (300) stays first.
		await expect.element(page.getByRole('row').nth(1)).toHaveTextContent('Alice');
		await expect.element(page.getByRole('row').nth(3)).toHaveTextContent('Bob');

		await userEvent.click(page.getByRole('button', { name: 'Amount' }));
		// Second click: ascending, Bob (100) first.
		await expect.element(page.getByRole('row').nth(1)).toHaveTextContent('Bob');
	});

	it('changes page size and paginates via Previous/Next', async () => {
		render(DataTable, { data: manyRows, columns });

		// Full 12-row set fits on one page by default; no pager shown yet.
		await expect.element(page.getByRole('button', { name: 'Next' })).not.toBeInTheDocument();

		await userEvent.click(page.getByRole('button', { name: 'Pages' }));
		// bits-ui's DropdownMenu.Item renders role="menuitem" on the underlying <button>,
		// which overrides its implicit "button" role for accessibility queries.
		await userEvent.click(page.getByRole('menuitem', { name: '10', exact: true }));

		await expect.element(page.getByRole('cell', { name: 'Row 1', exact: true })).toBeInTheDocument();
		await expect
			.element(page.getByRole('cell', { name: 'Row 11', exact: true }))
			.not.toBeInTheDocument();

		await userEvent.click(page.getByRole('button', { name: 'Next' }));
		await expect
			.element(page.getByRole('cell', { name: 'Row 11', exact: true }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Previous' })).toBeEnabled();
	});

	it('offers Print and Export to CSV actions in the export menu', async () => {
		const screen = render(DataTable, { data: rows, columns, fileName: 'MyReport' });

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
