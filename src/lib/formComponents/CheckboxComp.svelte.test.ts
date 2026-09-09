import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CheckboxComp from './CheckboxComp.svelte';

const items = [
	{ value: 1, name: 'Apples' },
	{ value: 2, name: 'Bananas' },
	{ value: 3, name: 'Cherries' }
];

describe('CheckboxComp.svelte', () => {
	it('renders a checkbox for every item plus a "Select All" checkbox', async () => {
		render(CheckboxComp, { items, checkedValues: [] });

		await expect.element(page.getByText('Select All')).toBeInTheDocument();
		await expect.element(page.getByText('Apples')).toBeInTheDocument();
		await expect.element(page.getByText('Bananas')).toBeInTheDocument();
		await expect.element(page.getByText('Cherries')).toBeInTheDocument();
	});

	it('pre-checks items that are already in checkedValues', async () => {
		render(CheckboxComp, { items, checkedValues: [2] });

		const checkboxes = page.getByRole('checkbox');
		await expect.element(checkboxes.nth(2)).toBeChecked(); // Bananas
		await expect.element(checkboxes.nth(1)).not.toBeChecked(); // Apples
	});

	it('checks an item when its label is clicked', async () => {
		render(CheckboxComp, { items, checkedValues: [] });

		await userEvent.click(page.getByText('Apples'));

		await expect.element(page.getByRole('checkbox').nth(1)).toBeChecked();
	});

	it('"Select All" checks every item', async () => {
		render(CheckboxComp, { items, checkedValues: [] });

		await userEvent.click(page.getByText('Select All'));

		const checkboxes = page.getByRole('checkbox');
		await expect.element(checkboxes.nth(0)).toBeChecked();
		await expect.element(checkboxes.nth(1)).toBeChecked();
		await expect.element(checkboxes.nth(2)).toBeChecked();
		await expect.element(checkboxes.nth(3)).toBeChecked();
	});

	it('"Select All" un-checks every item when all are already checked', async () => {
		render(CheckboxComp, { items, checkedValues: [1, 2, 3] });

		await userEvent.click(page.getByText('Select All'));

		const checkboxes = page.getByRole('checkbox');
		await expect.element(checkboxes.nth(1)).not.toBeChecked();
		await expect.element(checkboxes.nth(2)).not.toBeChecked();
		await expect.element(checkboxes.nth(3)).not.toBeChecked();
	});
});
