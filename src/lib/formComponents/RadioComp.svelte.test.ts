import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RadioComp from './RadioComp.svelte';

const items = [
	{ value: 'yes', name: 'Yes' },
	{ value: 'no', name: 'No' }
];

describe('RadioComp.svelte', () => {
	it('renders the group label and every item', async () => {
		render(RadioComp, { name: 'confirm', items, btnName: 'Confirm?' });

		await expect.element(page.getByText('Confirm?')).toBeInTheDocument();
		await expect.element(page.getByText('Yes')).toBeInTheDocument();
		await expect.element(page.getByText('No')).toBeInTheDocument();
	});

	it('renders one radio input per item', async () => {
		render(RadioComp, { name: 'confirm', items, btnName: 'Confirm?' });

		await expect.element(page.getByRole('radio').nth(0)).toBeInTheDocument();
		await expect.element(page.getByRole('radio').nth(1)).toBeInTheDocument();
	});

	it('selects an item when its radio input is clicked directly', async () => {
		render(RadioComp, { name: 'confirm', items, btnName: 'Confirm?' });

		await userEvent.click(page.getByRole('radio').nth(1));

		await expect.element(page.getByRole('radio').nth(1)).toBeChecked();
	});

	it('selects an item when its visible label text is clicked', async () => {
		// Every item's <label> in RadioComp.svelte is hardcoded to for="true" while
		// every <RadioGroup.Item> is hardcoded to id="option-one" (a bug: RadioComp.svelte
		// never uses `item.value` for the id). Clicking the label text a user actually
		// sees should still select the corresponding radio.
		render(RadioComp, { name: 'confirm', items, btnName: 'Confirm?' });

		await userEvent.click(page.getByText('No'));

		await expect.element(page.getByRole('radio').nth(1)).toBeChecked();
	});
});
