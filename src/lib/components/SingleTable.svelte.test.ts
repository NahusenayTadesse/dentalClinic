import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SingleTable from './SingleTable.svelte';

describe('SingleTable.svelte', () => {
	it('renders a Detail/Value row per entry', async () => {
		render(SingleTable, {
			singleTable: [
				{ name: 'Name', value: 'Jane Doe' },
				{ name: 'Email', value: 'jane@example.com' }
			]
		});

		await expect.element(page.getByText('Name')).toBeInTheDocument();
		await expect.element(page.getByText('Jane Doe')).toBeInTheDocument();
		await expect.element(page.getByText('Email')).toBeInTheDocument();
		await expect.element(page.getByText('jane@example.com')).toBeInTheDocument();
	});

	it('renders a clickable copy button for a "Phone" row', async () => {
		render(SingleTable, {
			singleTable: [{ name: 'Phone', value: '0912345678' }]
		});

		await expect.element(page.getByRole('button', { name: '0912345678' })).toBeInTheDocument();
	});

	it('renders a status badge for a "Status" row', async () => {
		const screen = render(SingleTable, {
			singleTable: [{ name: 'Status', value: 'active' }]
		});

		expect(screen.container.querySelector('.bg-green-400')).not.toBeNull();
	});

	it('renders nothing in the body when singleTable is empty', async () => {
		const screen = render(SingleTable, { singleTable: [] });

		await expect.element(page.getByText('Detail')).toBeInTheDocument();
		expect(screen.container.querySelectorAll('tbody tr').length).toBe(0);
	});
});
