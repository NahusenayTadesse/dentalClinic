import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SelectComp from './SelectComp.svelte';

const items = [
	{ value: 1, name: 'Active' },
	{ value: 2, name: 'Inactive' }
];

describe('SelectComp.svelte', () => {
	it('shows a "Select <field>" placeholder when nothing is selected', async () => {
		render(SelectComp, { name: 'employmentStatus', items, value: undefined });

		await expect.element(page.getByText('Select employment Status')).toBeInTheDocument();
	});

	it('shows the matching item name when a value is already selected', async () => {
		render(SelectComp, { name: 'employmentStatus', items, value: 2 });

		await expect.element(page.getByRole('button')).toHaveTextContent('Inactive');
	});

	it('matches string and number values for the same option (String coercion)', async () => {
		render(SelectComp, { name: 'employmentStatus', items, value: '2' });

		await expect.element(page.getByRole('button')).toHaveTextContent('Inactive');
	});

	it('opens the list and selects an option on click', async () => {
		render(SelectComp, { name: 'employmentStatus', items, value: undefined });

		await userEvent.click(page.getByRole('button'));
		await userEvent.click(page.getByRole('option', { name: 'Active', exact: true }));

		await expect.element(page.getByRole('button')).toHaveTextContent('Active');
	});
});
