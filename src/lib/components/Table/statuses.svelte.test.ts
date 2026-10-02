import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Statuses from './statuses.svelte';

describe('statuses.svelte', () => {
	it('renders the status text with a green badge for a known "good" status', async () => {
		const screen = await render(Statuses, { status: 'active' });

		await expect.element(page.getByText('active')).toBeInTheDocument();
		expect(screen.container.querySelector('.bg-green-400')).not.toBeNull();
	});

	it('renders a red badge for a known "bad" status', async () => {
		const screen = await render(Statuses, { status: 'cancelled' });

		await expect.element(page.getByText('cancelled')).toBeInTheDocument();
		expect(screen.container.querySelector('.bg-red-500')).not.toBeNull();
	});

	it('is case-insensitive and trims whitespace when matching', async () => {
		const screen = await render(Statuses, { status: '  Active  ' });

		expect(screen.container.querySelector('.bg-green-400')).not.toBeNull();
	});

	it('falls back to the "unknown" style for an unrecognised status', async () => {
		const screen = await render(Statuses, { status: 'some-made-up-status' });

		await expect.element(page.getByText('some-made-up-status')).toBeInTheDocument();
		expect(screen.container.querySelector('.bg-gray-500')).not.toBeNull();
	});
});
