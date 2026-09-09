import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FilterMenus from './FilterMenus.svelte';

const data = [
	{ id: 1, department: 'Sales', status: 'Active' },
	{ id: 2, department: 'Sales', status: 'Inactive' },
	{ id: 3, department: 'Engineering', status: 'Active' }
];

describe('FilterMenus.svelte', () => {
	it('renders a closed filter panel by default', async () => {
		render(FilterMenus, { data, filterKeys: ['department'], filteredList: data });

		await expect.element(page.getByText('Filters')).toBeInTheDocument();
		await expect.element(page.getByText('Filter Table', { exact: true })).not.toBeInTheDocument();
	});

	it('opens the panel and shows the unfiltered result count', async () => {
		render(FilterMenus, { data, filterKeys: ['department'], filteredList: data });

		await userEvent.click(page.getByText('Filters'));

		await expect.element(page.getByText('Filter Table', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Showing 3 results')).toBeInTheDocument();
	});

	it('narrows the results when a filter value is selected, and shows an active-filter badge', async () => {
		render(FilterMenus, { data, filterKeys: ['department'], filteredList: data });

		await userEvent.click(page.getByText('Filters'));
		await userEvent.click(page.getByRole('combobox'));
		await userEvent.fill(page.getByPlaceholder('Search departments...'), 'Engineering');
		await userEvent.click(page.getByText('Engineering'));

		await expect.element(page.getByText('Showing 1 results')).toBeInTheDocument();
		await expect.element(page.getByText('1 active', { exact: true })).toBeInTheDocument();
	});

	it('resets filters back to showing every result', async () => {
		render(FilterMenus, { data, filterKeys: ['department'], filteredList: data });

		await userEvent.click(page.getByText('Filters'));
		await userEvent.click(page.getByRole('combobox'));
		await userEvent.fill(page.getByPlaceholder('Search departments...'), 'Engineering');
		await userEvent.click(page.getByText('Engineering'));
		await expect.element(page.getByText('Showing 1 results')).toBeInTheDocument();

		await userEvent.click(page.getByRole('button', { name: /Reset/i }));

		await expect.element(page.getByText('Showing 3 results')).toBeInTheDocument();
	});
});
