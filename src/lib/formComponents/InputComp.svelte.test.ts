import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { writable, get } from 'svelte/store';
import InputComp from './InputComp.svelte';

describe('InputComp.svelte', () => {
	/*
	 * Was "currently broken", and was: `<Label for={name}>` sat beside an `<Input>` that got
	 * `name` but never `id`, so `for` pointed at nothing. Clicking the label focused nothing and
	 * a screen reader never paired them — across all 76 call sites.
	 */
	it('associates the visible label with its input via id/for', async () => {
		const form = writable<Record<string, unknown>>({ name: '' });
		const errors = writable<Record<string, unknown>>({});

		render(InputComp, { label: 'Name', form, errors, type: 'text', name: 'name' });

		await expect.element(page.getByLabelText('Name')).toBeInTheDocument();
	});

	it('marks the field invalid and announces the message', async () => {
		const form = writable<Record<string, unknown>>({ name: '' });
		const errors = writable<Record<string, unknown>>({ name: ['Name is required'] });

		const screen = render(InputComp, {
			label: 'Name',
			form,
			errors,
			type: 'text',
			name: 'name'
		});

		const input = screen.container.querySelector('input') as HTMLInputElement;
		// The styling for this already existed in components/ui/input and was never switched on.
		expect(input.getAttribute('aria-invalid')).toBe('true');

		// The message is announced, and tied to the field rather than merely near it.
		const described = input.getAttribute('aria-describedby');
		expect(described).toBeTruthy();
		expect(screen.container.querySelector(`#${described}`)?.getAttribute('role')).toBe('alert');
		await expect.element(page.getByText('Name is required')).toBeInTheDocument();
	});

	it('leaves aria-invalid off when the field is fine', async () => {
		const form = writable<Record<string, unknown>>({ name: '' });
		const errors = writable<Record<string, unknown>>({});

		const screen = render(InputComp, { label: 'Name', form, errors, type: 'text', name: 'name' });

		const input = screen.container.querySelector('input') as HTMLInputElement;
		expect(input.getAttribute('aria-invalid')).toBeNull();
		expect(input.getAttribute('aria-describedby')).toBeNull();
	});

	it('puts step only on a number, not on every input', async () => {
		const form = writable<Record<string, unknown>>({ qty: 0, note: '' });
		const errors = writable<Record<string, unknown>>({});

		const number = render(InputComp, { label: 'Qty', form, errors, type: 'number', name: 'qty' });
		expect(number.container.querySelector('input')?.getAttribute('step')).toBe('any');

		// `step="any"` used to go on text inputs too, where it means nothing, and on numbers it
		// switched off step validation entirely.
		const text = render(InputComp, { label: 'Note', form, errors, type: 'text', name: 'note' });
		expect(text.container.querySelectorAll('input')[0]?.getAttribute('step')).toBeNull();
	});

	it('updates the form store when typing in a text input', async () => {
		const form = writable<Record<string, unknown>>({ name: '' });
		const errors = writable<Record<string, unknown>>({});

		render(InputComp, { label: 'Name', form, errors, type: 'text', name: 'name' });

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
