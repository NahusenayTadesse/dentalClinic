import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Pdf from './pdf.svelte';

// A minimal stand-in for a TanStack table instance — pdf.svelte only ever calls
// getHeaderGroups()/getRowModel() on it (inside handlers we deliberately don't
// trigger below, since Print/CSV export have real side effects: a hidden iframe
// + window.print(), and a blob download).
const fakeTable = {
	getHeaderGroups: () => [],
	getRowModel: () => ({ rows: [] })
};

describe('Table/pdf.svelte', () => {
	it('renders a download trigger button', async () => {
		render(Pdf, { fileName: 'Report', table: fakeTable });

		await expect.element(page.getByRole('button')).toBeInTheDocument();
	});

	it('offers Print and Export to CSV once opened', async () => {
		render(Pdf, { fileName: 'Report', table: fakeTable });

		await userEvent.click(page.getByRole('button'));

		await expect.element(page.getByText('Print')).toBeInTheDocument();
		await expect.element(page.getByText('Export to CSV')).toBeInTheDocument();
	});
});
