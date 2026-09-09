import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LoadingBtn from './LoadingBtn.svelte';

describe('LoadingBtn.svelte', () => {
	it('renders the spinner and the given name with an ellipsis', async () => {
		render(LoadingBtn, { name: 'Saving' });

		await expect.element(page.getByText('Saving...')).toBeInTheDocument();
	});

	it('renders a different name correctly', async () => {
		render(LoadingBtn, { name: 'Deleting' });

		await expect.element(page.getByText('Deleting...')).toBeInTheDocument();
		await expect.element(page.getByText('Saving...')).not.toBeInTheDocument();
	});
});
