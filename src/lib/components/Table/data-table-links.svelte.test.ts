import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Pencil } from '@lucide/svelte';
import DataTableLinks from './data-table-links.svelte';

describe('data-table-links.svelte', () => {
	it('renders a link with the given name pointed at link/id', async () => {
		render(DataTableLinks, { id: '42', name: 'View Employee', link: '/dashboard/employees' });

		const link = page.getByRole('link', { name: 'View Employee' });
		await expect.element(link).toBeInTheDocument();
		await expect.element(link).toHaveAttribute('href', '/dashboard/employees/42');
	});

	it('renders an icon when IconComp is provided', async () => {
		const screen = render(DataTableLinks, {
			id: '1',
			name: 'Edit',
			link: '/dashboard/items',
			IconComp: Pencil
		});

		expect(screen.container.querySelector('svg')).not.toBeNull();
	});

	it('opens in a new tab when target is set', async () => {
		// `target` is also a reserved Svelte mount-option name, so it must be passed
		// under an explicit `props` key here or vitest-browser-svelte's render()
		// misinterprets the whole props object as mount options instead of props.
		render(DataTableLinks, {
			props: {
				id: '1',
				name: 'Open',
				link: '/dashboard/items',
				target: '_blank'
			}
		});

		await expect
			.element(page.getByRole('link', { name: 'Open' }))
			.toHaveAttribute('target', '_blank');
	});
});
