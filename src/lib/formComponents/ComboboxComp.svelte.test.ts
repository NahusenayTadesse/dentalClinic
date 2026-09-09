import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ComboboxComp from './ComboboxComp.svelte';

const items = [
	{ value: 1, name: 'Addis Ababa' },
	{ value: 2, name: 'Bahir Dar' }
];

describe('ComboboxComp.svelte', () => {
	it('shows a "Select <field>" placeholder when nothing is selected', async () => {
		render(ComboboxComp, { name: 'subcity', items, value: undefined, required: false });

		await expect.element(page.getByText('Select subcity')).toBeInTheDocument();
	});

	it('shows the matching item name when a value is already selected', async () => {
		render(ComboboxComp, { name: 'subcity', items, value: 2, required: false });

		await expect.element(page.getByRole('combobox')).toHaveTextContent('Bahir Dar');
	});

	it('opens the list, filters via search, and selects an option on click', async () => {
		render(ComboboxComp, { name: 'subcity', items, value: undefined, required: false });

		await userEvent.click(page.getByRole('combobox'));
		await userEvent.fill(page.getByPlaceholder('Search subcity...'), 'Bahir');

		await expect.element(page.getByText('Addis Ababa')).not.toBeInTheDocument();
		await userEvent.click(page.getByText('Bahir Dar'));

		await expect.element(page.getByRole('combobox')).toHaveTextContent('Bahir Dar');
	});

	it('shows an empty state when the search matches nothing', async () => {
		render(ComboboxComp, { name: 'subcity', items, value: undefined, required: false });

		await userEvent.click(page.getByRole('combobox'));
		await userEvent.fill(page.getByPlaceholder('Search subcity...'), 'zzzzz');

		await expect.element(page.getByText('No subcity found.')).toBeInTheDocument();
	});
});
