import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { writable, get } from 'svelte/store';
import InputComp from './InputComp.svelte';

describe('InputComp.svelte', () => {
	// KNOWN BUG: InputComp.svelte renders <Label for={name}> next to the underlying
	// <Input>/<Textarea>, but never passes an `id` prop to them — only `name`. The
	// label's `for` attribute therefore points at an id that doesn't exist anywhere
	// in the DOM, so the label is not programmatically associated with its field
	// (bad for accessibility, and clicking the label text won't focus the input).
	// This test intentionally asserts the *correct* behavior and is expected to FAIL
	// until that's fixed.
	it('associates the visible label with its input via id/for (currently broken)', async () => {
		const form = writable<Record<string, unknown>>({ name: '' });
		const errors = writable<Record<string, unknown>>({});

		render(InputComp, { label: 'Name', form, errors, type: 'text', name: 'name' });

		await expect.element(page.getByLabelText('Name')).toBeInTheDocument();
	});

	it('updates the form store when typing in a text input', async () => {
		const form = writable<Record<string, unknown>>({ name: '' });
		const errors = writable<Record<string, unknown>>({});

		render(InputComp, { label: 'Name', form, errors, type: 'text', name: 'name' });

		// Queried by role instead of label, since the label isn't associated (see bug above).
		await userEvent.fill(page.getByRole('textbox'), 'John Doe');

		expect(get(form).name).toBe('John Doe');
	});

	it('renders a textarea for type="textarea" and updates the form store on typing', async () => {
		const form = writable<Record<string, unknown>>({ description: '' });
		const errors = writable<Record<string, unknown>>({});

		render(InputComp, {
			label: 'Description',
			form,
			errors,
			type: 'textarea',
			name: 'description'
		});

		await userEvent.fill(page.getByRole('textbox'), 'Some notes');

		expect(get(form).description).toBe('Some notes');
	});

	it('renders a select for type="select" and updates the form store on choice', async () => {
		const form = writable<Record<string, unknown>>({ status: '' });
		const errors = writable<Record<string, unknown>>({});
		const items = [
			{ value: true, name: 'Active' },
			{ value: false, name: 'Inactive' }
		];

		render(InputComp, { label: 'Status', form, errors, type: 'select', name: 'status', items });

		await userEvent.click(page.getByRole('button'));
		await userEvent.click(page.getByRole('option', { name: 'Active', exact: true }));

		expect(get(form).status).toBe(true);
	});

	it('renders a checkboxSingle bound to a boolean form field', async () => {
		const form = writable<Record<string, unknown>>({ agree: false });
		const errors = writable<Record<string, unknown>>({});

		render(InputComp, {
			label: 'Agreement',
			form,
			errors,
			type: 'checkboxSingle',
			name: 'agree',
			placeholder: 'I agree to the terms'
		});

		await expect.element(page.getByText('I agree to the terms')).toBeInTheDocument();
		await userEvent.click(page.getByRole('checkbox'));

		expect(get(form).agree).toBe(true);
	});

	it('shows a plain-string error for the field', async () => {
		const form = writable<Record<string, unknown>>({ name: '' });
		const errors = writable<Record<string, unknown>>({ name: 'Name is required' });

		render(InputComp, { label: 'Name', form, errors, type: 'text', name: 'name' });

		await expect.element(page.getByText('Name is required')).toBeInTheDocument();
	});

	it('shows every message for a Zod-style _errors array', async () => {
		const form = writable<Record<string, unknown>>({ name: '' });
		const errors = writable<Record<string, unknown>>({
			name: { _errors: ['Name is required', 'Name must be at least 2 characters'] }
		});

		render(InputComp, { label: 'Name', form, errors, type: 'text', name: 'name' });

		await expect.element(page.getByText('Name is required')).toBeInTheDocument();
		await expect.element(page.getByText('Name must be at least 2 characters')).toBeInTheDocument();
	});

	it('shows no error message when there is none for the field', async () => {
		const form = writable<Record<string, unknown>>({ name: '' });
		const errors = writable<Record<string, unknown>>({});

		const screen = render(InputComp, { label: 'Name', form, errors, type: 'text', name: 'name' });

		expect(screen.container.querySelector('.text-red-500')).toBeNull();
	});
});
