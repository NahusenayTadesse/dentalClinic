import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DataTableSort from './data-table-sort.svelte';

describe('data-table-sort.svelte', () => {
	it('renders the column name', async () => {
		render(DataTableSort, { name: 'Amount' });

		await expect.element(page.getByRole('button', { name: 'Amount' })).toBeInTheDocument();
	});

	it('calls the provided onclick handler when clicked', async () => {
		const onclick = vi.fn();
		render(DataTableSort, { name: 'Amount', onclick });

		await userEvent.click(page.getByRole('button', { name: 'Amount' }));

		expect(onclick).toHaveBeenCalledTimes(1);
	});
});
