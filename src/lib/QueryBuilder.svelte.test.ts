import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QueryBuilder from './QueryBuilder.svelte';

/**
 * The bar collapses to a single button by default, so anything exercising the
 * panel itself renders with `defaultOpen: true`. The collapsing is covered on
 * its own at the bottom.
 */
describe('QueryBuilder.svelte', () => {
	it('renders the default title and description', async () => {
		await render(QueryBuilder, { defaultOpen: true });

		await expect.element(page.getByText('Query Builder')).toBeInTheDocument();
		await expect
			.element(page.getByText('Filter, search, and manage dataset limits'))
			.toBeInTheDocument();
	});

	it('renders a custom title and description', async () => {
		await render(QueryBuilder, {
			defaultOpen: true,
			title: 'Employee Filters',
			description: 'Narrow down the list'
		});

		await expect.element(page.getByText('Employee Filters')).toBeInTheDocument();
		await expect.element(page.getByText('Narrow down the list')).toBeInTheDocument();
	});

	it('hides the search box when showSearch is false', async () => {
		await render(QueryBuilder, { defaultOpen: true, showSearch: false });

		await expect.element(page.getByPlaceholder('Search rows...')).not.toBeInTheDocument();
	});

	it('emits onQueryChange with the trimmed search term on submit (manual mode)', async () => {
		const onQueryChange = vi.fn();
		await render(QueryBuilder, { defaultOpen: true, onQueryChange });

		await userEvent.fill(page.getByPlaceholder('Search rows...'), '  Addis  ');
		await userEvent.keyboard('{Enter}');

		expect(onQueryChange).toHaveBeenCalledTimes(1);
		expect(onQueryChange.mock.calls[0][0]).toMatchObject({ search: 'Addis', pageSize: 20 });
	});

	it('does not emit onQueryChange while typing in manual mode (no debounce fire)', async () => {
		const onQueryChange = vi.fn();
		await render(QueryBuilder, { defaultOpen: true, onQueryChange, submitMode: 'manual' });

		await userEvent.fill(page.getByPlaceholder('Search rows...'), 'Addis');

		expect(onQueryChange).not.toHaveBeenCalled();
	});

	it('changes page size and emits onQueryChange', async () => {
		const onQueryChange = vi.fn();
		await render(QueryBuilder, { defaultOpen: true, onQueryChange, initialPageSize: 20 });

		await expect.element(page.getByText('20 per page')).toBeInTheDocument();

		await userEvent.click(page.getByText('20 per page'));
		await userEvent.click(page.getByRole('option', { name: '50 per page' }));

		await expect.element(page.getByText('50 per page')).toBeInTheDocument();
		expect(onQueryChange).toHaveBeenCalledTimes(1);
		expect(onQueryChange.mock.calls[0][0]).toMatchObject({ pageSize: 50 });
	});

	it('shows the active filter count and a "Clear all" button once a filter changes, then clears it', async () => {
		const onQueryChange = vi.fn();
		await render(QueryBuilder, { defaultOpen: true, onQueryChange, initialPageSize: 20 });

		await userEvent.click(page.getByText('20 per page'));
		await userEvent.click(page.getByRole('option', { name: '100 per page' }));

		await expect.element(page.getByText('1 active filter')).toBeInTheDocument();

		await userEvent.click(page.getByRole('button', { name: /Clear all/i }));

		await expect.element(page.getByText('20 per page')).toBeInTheDocument();
		await expect.element(page.getByText('1 active filter')).not.toBeInTheDocument();
	});

	it('shows a loading badge with custom text when isLoading is true', async () => {
		await render(QueryBuilder, { defaultOpen: true, isLoading: true, loadingText: 'Fetching…' });

		await expect.element(page.getByText('Fetching…')).toBeInTheDocument();
	});

	it('shows the total result count, pluralised correctly', async () => {
		const { rerender } = await render(QueryBuilder, { defaultOpen: true, totalResults: 1 });
		await expect.element(page.getByText('1 result')).toBeInTheDocument();

		await rerender({ totalResults: 5 });
		await expect.element(page.getByText('5 results')).toBeInTheDocument();
	});

	// --- Collapsing --------------------------------------------------------

	it('starts collapsed: the panel is a single button until it is clicked', async () => {
		await render(QueryBuilder, { title: 'Site Query' });

		await expect.element(page.getByPlaceholder('Search rows...')).not.toBeInTheDocument();

		await userEvent.click(page.getByRole('button', { name: /Site Query/i }));

		await expect.element(page.getByPlaceholder('Search rows...')).toBeInTheDocument();
	});

	it('collapses again from the Hide button', async () => {
		await render(QueryBuilder, { defaultOpen: true });

		await expect.element(page.getByPlaceholder('Search rows...')).toBeInTheDocument();

		await userEvent.click(page.getByRole('button', { name: /Hide/i }));

		await expect.element(page.getByPlaceholder('Search rows...')).not.toBeInTheDocument();
	});

	it('keeps the result count visible while collapsed', async () => {
		await render(QueryBuilder, { totalResults: 12 });

		await expect.element(page.getByText('12 results')).toBeInTheDocument();
		await expect.element(page.getByPlaceholder('Search rows...')).not.toBeInTheDocument();
	});

	it('stays open with no Hide button when collapsible is false', async () => {
		await render(QueryBuilder, { collapsible: false });

		await expect.element(page.getByPlaceholder('Search rows...')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Hide/i })).not.toBeInTheDocument();
	});

	// --- The unfiltered baseline ------------------------------------------
	// The `initial*` props carry what the URL says, which is not the same thing
	// as what counts as filtered. Opening a filtered link used to report nothing
	// active, and `Clear all` reset the filters to themselves.

	it('counts filters that arrived in the URL as active', async () => {
		await render(QueryBuilder, {
			defaultOpen: true,
			initialSearch: 'Addis',
			initialCustomFilters: { branchId: '4' }
		});

		await expect.element(page.getByText('2 active filters')).toBeInTheDocument();
	});

	it('counts a page size that arrived in the URL as active', async () => {
		await render(QueryBuilder, { defaultOpen: true, initialPageSize: 100 });

		await expect.element(page.getByText('1 active filter')).toBeInTheDocument();
	});

	it('clears filters that arrived in the URL rather than restoring them', async () => {
		const onQueryChange = vi.fn();
		await render(QueryBuilder, {
			defaultOpen: true,
			onQueryChange,
			initialSearch: 'Addis',
			initialPageSize: 50,
			initialCustomFilters: { branchId: '4' }
		});

		await userEvent.click(page.getByRole('button', { name: /Clear all/i }));

		expect(onQueryChange.mock.calls[0][0]).toMatchObject({
			search: '',
			pageSize: 20,
			customFilters: { branchId: '' }
		});
		await expect.element(page.getByText('active filter')).not.toBeInTheDocument();
	});

	it('does not count a date range that matches the page default', async () => {
		await render(QueryBuilder, {
			defaultOpen: true,
			showDate: true,
			initialStart: '2026-01-01',
			initialEnd: '2026-12-31',
			defaultStart: '2026-01-01',
			defaultEnd: '2026-12-31'
		});

		await expect.element(page.getByText('active filter')).not.toBeInTheDocument();
	});

	it('counts a date range that differs from the page default', async () => {
		await render(QueryBuilder, {
			defaultOpen: true,
			showDate: true,
			initialStart: '2026-03-01',
			initialEnd: '2026-03-31',
			defaultStart: '2026-01-01',
			defaultEnd: '2026-12-31'
		});

		await expect.element(page.getByText('1 active filter')).toBeInTheDocument();
	});

	// --- Staying in step with the URL --------------------------------------

	it('resyncs the controls when the query changes underneath it', async () => {
		const { rerender } = await render(QueryBuilder, {
			defaultOpen: true,
			initialSearch: 'Addis',
			initialPageSize: 20,
			initialCustomFilters: { branchId: '4' }
		});

		await expect.element(page.getByPlaceholder('Search rows...')).toHaveValue('Addis');

		// What a Back button or a pagination link does: same instance, new query.
		await rerender({
			initialSearch: 'Bahir Dar',
			initialPageSize: 50,
			initialCustomFilters: { branchId: '9' }
		});

		await expect.element(page.getByPlaceholder('Search rows...')).toHaveValue('Bahir Dar');
		await expect.element(page.getByText('50 per page')).toBeInTheDocument();
	});
});
