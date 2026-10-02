import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Errors from './Errors.svelte';

describe('Errors.svelte', () => {
	it('renders nothing when allErrors is empty', async () => {
		const screen = await render(Errors, { allErrors: [] });

		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
		expect(screen.container.textContent?.trim()).toBe('');
	});

	it('renders an alert listing every error message when allErrors is non-empty', async () => {
		await render(Errors, {
			allErrors: [{ messages: 'Name is required' }, { messages: 'Email is invalid' }]
		});

		const alert = page.getByRole('alert');
		await expect.element(alert).toBeInTheDocument();
		await expect.element(page.getByText('Name is required')).toBeInTheDocument();
		await expect.element(page.getByText('Email is invalid')).toBeInTheDocument();
	});
});
