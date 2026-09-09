import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FilterMenu from './FilterMenu.svelte';

const data = [
	{ id: 1, department: 'Sales', status: 'Active' },
	{ id: 2, department: 'Sales', status: 'Inactive' },
	{ id: 3, department: 'Engineering', status: 'Active' }
];

describe('FilterMenu.svelte', () => {
	it('renders the Table Filters and Chart toggle buttons, both closed by default', async () => {
		render(FilterMenu, { data, filterKeys: ['department'] });

		await expect.element(page.getByText('Table Filters')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /^Chart/ })).toBeInTheDocument();
		await expect.element(page.getByText('Filter Charts')).not.toBeInTheDocument();
	});

	it('opens the filter panel and narrows results by a selected value', async () => {
		render(FilterMenu, { data, filterKeys: ['department'] });

		await userEvent.click(page.getByText('Table Filters'));
		await expect.element(page.getByText('Showing 3 of 3 records')).toBeInTheDocument();

		await userEvent.click(page.getByRole('combobox'));
		await userEvent.fill(page.getByPlaceholder('Search departments...'), 'Engineering');
		await userEvent.click(page.getByText('Engineering'));

		await expect.element(page.getByText('Showing 1 of 3 records')).toBeInTheDocument();
	});

	it('opens the chart panel with a chart-type picker and one tab per filter key', async () => {
		render(FilterMenu, { data, filterKeys: ['department', 'status'] });

		await userEvent.click(page.getByRole('button', { name: /^Chart/ }));

		// Clicking the "Chart" toggle sets `type = 'bar'` immediately, so the picker
		// shows "Bar" (not its unselected "Chart Type" placeholder) right away.
		await expect.element(page.getByText('Bar', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Department' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Status' })).toBeInTheDocument();
	});
});
