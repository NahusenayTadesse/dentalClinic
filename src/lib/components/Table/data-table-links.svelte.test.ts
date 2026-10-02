import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Pencil } from '@lucide/svelte';
import DataTableLinks from './data-table-links.svelte';

describe('data-table-links.svelte', () => {
	it('renders a link with the given name pointed at link/id', async () => {
		await render(DataTableLinks, { id: '42', name: 'View Employee', link: '/dashboard/employees' });

		const link = page.getByRole('link', { name: 'View Employee' });
		await expect.element(link).toBeInTheDocument();
		await expect.element(link).toHaveAttribute('href', '/dashboard/employees/42');
	});

	it('renders an icon when IconComp is provided', async () => {
		const screen = await render(DataTableLinks, {
			id: '1',
			name: 'Edit',
			link: '/dashboard/items',
			IconComp: Pencil
		});

		expect(screen.container.querySelector('svg')).not.toBeNull();
	});

	/*
	 * The rule this component exists to enforce: a mention of a record is a link when the viewer
	 * may open it and plain text when they may not. Without a viewer context there are no
	 * permissions, which is the safe default — so an `entity` mention renders as text here.
	 */
	it('renders an entity mention as plain text when the viewer may not open it', async () => {
		const screen = await render(DataTableLinks, { id: 7, name: 'Dr Alem', entity: 'employee' });

		await expect.element(page.getByText('Dr Alem')).toBeInTheDocument();
		expect(
			screen.container.querySelector('a'),
			'must not advertise a page that would 403'
		).toBeNull();
	});

	it('still renders an explicit link with no permission check', async () => {
		// The original form, kept for the 71 call sites and for targets that are not records.
		await render(DataTableLinks, { id: '9', name: 'View Reciept', link: '/dashboard/files' });

		await expect
			.element(page.getByRole('link', { name: 'View Reciept' }))
			.toHaveAttribute('href', '/dashboard/files/9');
	});

	it('renders plain text when there is no id to point at', async () => {
		const screen = await render(DataTableLinks, {
			id: null,
			name: 'Unassigned',
			link: '/dashboard/x'
		});

		await expect.element(page.getByText('Unassigned')).toBeInTheDocument();
		expect(screen.container.querySelector('a')).toBeNull();
	});

	it('opens in a new tab when target is set', async () => {
		// `target` is also a reserved Svelte mount-option name, so it must be passed
		// under an explicit `props` key here or vitest-browser-svelte's await render()
		// misinterprets the whole props object as mount options instead of props.
		await render(DataTableLinks, {
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
