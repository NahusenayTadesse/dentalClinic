import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BigText from './bigText.svelte';

describe('bigText.svelte', () => {
	it('shows short text as-is with no truncation', async () => {
		await render(BigText, { text: 'Short text' });

		await expect.element(page.getByText('Short text', { exact: true })).toBeInTheDocument();
	});

	it('truncates long text to 15 characters plus an ellipsis', async () => {
		await render(BigText, { text: 'This is a very long piece of text' });

		// "This is a very " is 15 chars + '...'
		await expect.element(page.getByText('This is a very ...')).toBeInTheDocument();
	});

	it('reveals the full text in a popover when the truncated trigger is clicked', async () => {
		const longText = 'This is a very long piece of text';
		await render(BigText, { text: longText });

		await userEvent.click(page.getByText('This is a very ...'));

		await expect.element(page.getByText(longText, { exact: true })).toBeInTheDocument();
	});
});
