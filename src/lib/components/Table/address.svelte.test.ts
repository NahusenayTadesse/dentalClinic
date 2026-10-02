import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Address from './address.svelte';

describe('Table/address.svelte', () => {
	it('shows a "No address information" message when every field is empty', async () => {
		await render(Address, {});

		await userEvent.click(page.getByRole('button'));

		await expect.element(page.getByText('No address information available')).toBeInTheDocument();
	});

	it('lists every populated address field once opened', async () => {
		await render(Address, {
			subcity: 'Bole',
			street: 'Main Street',
			kebele: '05',
			buildingNumber: 'B-12',
			floor: '3',
			houseNumber: '101'
		});

		await userEvent.click(page.getByRole('button'));

		// exact: true — the dialog's trigger/title/description also contain "Bole" etc.
		// as part of the truncated/full concatenated address string.
		await expect.element(page.getByText('Bole', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Main Street', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('05', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('B-12', { exact: true })).toBeInTheDocument();
	});

	/*
	 * The filtered list is the one the panel renders now. It was computed and then ignored — the
	 * template listed all six fields, so an address with two of them showed four empty rows.
	 */
	it('omits fields that are not provided', async () => {
		await render(Address, { subcity: 'Bole', street: 'Main Street' });

		await userEvent.click(page.getByRole('button'));

		await expect.element(page.getByText('Subcity', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Street', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Kebele', { exact: true })).not.toBeInTheDocument();
	});

	it('truncates a long concatenated address in the trigger label', async () => {
		await render(Address, {
			subcity: 'A Very Long Subcity Name',
			street: 'A Very Long Street Name'
		});

		// truncate() cuts at 15 chars + '...': "A Very Long Sub" + "..."
		await expect.element(page.getByRole('button')).toHaveTextContent('A Very Long Sub...');
	});
});
