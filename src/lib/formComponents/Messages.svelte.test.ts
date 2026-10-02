import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { writable } from 'svelte/store';
import Messages from './Messages.svelte';

describe('Messages.svelte', () => {
	it('renders nothing when the message store is empty', async () => {
		const message = writable(undefined);
		const screen = await render(Messages, { message });

		expect(screen.container.textContent?.trim()).toBe('');
	});

	it('renders a success message in green', async () => {
		const message = writable({ type: 'success', text: 'Saved successfully' });
		await render(Messages, { message });

		const el = page.getByText('Saved successfully');
		await expect.element(el).toBeInTheDocument();
		await expect.element(el).toHaveClass('text-green-500');
	});

	it('renders an error message in red', async () => {
		const message = writable({ type: 'error', text: 'Something went wrong' });
		await render(Messages, { message });

		const el = page.getByText('Something went wrong');
		await expect.element(el).toBeInTheDocument();
		await expect.element(el).toHaveClass('text-red-500');
	});
});
