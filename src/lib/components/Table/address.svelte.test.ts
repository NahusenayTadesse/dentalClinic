import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Address from './address.svelte';

describe('Table/address.svelte', () => {
	it('shows a "No address information" message when every field is empty', async () => {
		render(Address, {});

		await userEvent.click(page.getByRole('button'));

		await expect
			.element(page.getByText('No address information available'))
			.toBeInTheDocument();
	});

	it('lists every populated address field once opened', async () => {
		render(Address, {
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

	// KNOWN BUG: address.svelte computes a filtered `addressFields` array (only fields
	// that actually have a value) via $derived, but the template never renders it —
	// it renders the unfiltered `hierarchyItems` array instead, which always lists all
	// six fields regardless of whether they were provided. So `addressFields`/`hasAddress`
	// end up only gating whether the panel is shown at all, not which rows appear in it.
	// This test asserts the sensible behavior (omit fields that were never provided) and
	// is expected to FAIL until the template is switched to use `addressFields`.
	it('omits fields that are not provided (currently broken)', async () => {
		render(Address, { subcity: 'Bole', street: 'Main Street' });

		await userEvent.click(page.getByRole('button'));

		await expect.element(page.getByText('Subcity', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Street', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('Kebele', { exact: true })).not.toBeInTheDocument();
	});

	it('truncates a long concatenated address in the trigger label', async () => {
		render(Address, {
			subcity: 'A Very Long Subcity Name',
			street: 'A Very Long Street Name'
		});

		// truncate() cuts at 15 chars + '...': "A Very Long Sub" + "..."
		await expect
			.element(page.getByRole('button'))
			.toHaveTextContent('A Very Long Sub...');
	});
});
