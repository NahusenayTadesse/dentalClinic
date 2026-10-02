<script lang="ts">
	import type { Writable } from 'svelte/store';
	// The shared picker option, not a local copy of it (CLAUDE.md §1).
	import type { Item } from '$lib/global.svelte';

	/* eslint-disable @typescript-eslint/no-explicit-any */
	/**
	 * The superforms `$form` and `$errors` stores, typed loosely and deliberately.
	 *
	 * `Writable<T>` is invariant — it both reads and writes T — so a concretely-typed form store
	 * is *not* assignable to `Writable<Record<string, unknown>>`. Declaring the strict type here
	 * produced ninety errors across the call sites and caught no real bug: indexing by an
	 * arbitrary `name` is this component's entire job, so the shape genuinely is dynamic at this
	 * boundary. A named alias with its reason, the same escape `AnyTable` takes in `crud.ts`
	 * (CLAUDE.md §3) — not an inline `any`.
	 *
	 * The typing that would actually pay here is `name: keyof T & string`, which would catch a
	 * misspelled field. That needs the component generic over the form shape and every caller
	 * to cooperate; worth doing, too big to smuggle in with this.
	 */
	type FormStore = Writable<Record<string, any>>;
	/* eslint-enable @typescript-eslint/no-explicit-any */
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Textarea } from '@nahu/admin-kit/components/ui/textarea/index.js';
	import { Label } from '@nahu/admin-kit/components/ui/label/index.js';
	import { Checkbox } from '@nahu/admin-kit/components/ui/checkbox/index.js';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Button from '@nahu/admin-kit/components/ui/button/button.svelte';

	import FileUpload from '@nahu/admin-kit/formComponents/FileUpload.svelte';
	import DatePicker from './DatePicker.svelte';
	import DateRangePicker from './DateRangePicker.svelte';
	import SelectComp from '@nahu/admin-kit/formComponents/SelectComp.svelte';
	import ComboboxComp from '@nahu/admin-kit/formComponents/ComboboxComp.svelte';
	import CheckboxComp from './CheckboxComp.svelte';

	/**
	 * One form field, dispatching on `type`.
	 *
	 * The most-used component in the app — 76 callers — and until now the least typed: `$props()`
	 * carried no annotation in a `lang="ts"` file, so every prop at every call site was an
	 * implicit `any` and a misspelled one was silent.
	 *
	 * **Three things it was getting wrong, all of them invisible:**
	 *
	 * - The label pointed nowhere. `<Label for={name}>` sat beside an `<Input>` that was given
	 *   `name` but never `id`, so `for` referenced an element that did not exist: clicking the
	 *   label focused nothing and a screen reader never paired them. There is a test named
	 *   "currently broken" that has been failing on this.
	 * - `aria-invalid` was never set, although `components/ui/input` already carries the styling
	 *   for it. Six route files hand-rolled the attribute themselves, which is §2's second copy.
	 * - `step="any"` went onto every plain input, including text ones, and switched off step
	 *   validation on numbers.
	 */
	/*
	 * Taken from what the 76 call sites actually pass, not from what a form field ought to have:
	 * `hidden`, `time` and `range` are all in use and a narrower union just turned them into
	 * errors. Anything not named here falls through to the plain `<Input>`, which is why the
	 * fallback is a string rather than a closed list.
	 */
	type FieldType =
		| 'text'
		| 'email'
		| 'number'
		| 'tel'
		| 'url'
		| 'time'
		| 'date'
		| 'hidden'
		| 'range'
		| 'password'
		| 'textarea'
		| 'file'
		| 'select'
		| 'dateMultiple'
		| 'combo'
		| 'checkbox'
		| 'checkboxSingle'
		| (string & {});

	let {
		label,
		form,
		name,
		errors,
		type = 'text',
		required = false,
		max = '',
		min = '',
		step,
		placeholder = '',
		rows = 5,
		items = [],
		oldDays = true,
		year = false,
		futureDays = false,
		image = '',
		compress = true,
		disabled = false,
		id = undefined,
		description = undefined,
		allowEmpty = undefined
	}: {
		label: string;
		/** The superforms `$form` store. Indexed by `name`. */
		form: FormStore;
		name: string;
		/** The superforms `$errors` store. */
		errors: FormStore;
		type?: FieldType;
		required?: boolean;
		max?: string | number;
		min?: string | number;
		/** Only meaningful on `number`. Left unset elsewhere rather than forced to `any`. */
		step?: string | number;
		placeholder?: string;
		rows?: number;
		items?: Item[];
		oldDays?: boolean;
		year?: boolean;
		futureDays?: boolean;
		image?: string;
		/** Files only: shrink an image before upload. Off for a radiograph, whose detail is the point. */
		compress?: boolean;
		disabled?: boolean;
		/** Defaults to `name`, which is unique within a form. Set it when two forms share a page. */
		id?: string;
		/** Hint shown under the field, and announced with it. */
		description?: string;
		/**
		 * Dates only: start blank rather than on today. Defaults to "when the field is optional". A
		 * required date that must be read off something — the expiry on a box — sets it, because
		 * today pre-filled is a value nobody entered, and saved unread it is a wrong one.
		 */
		allowEmpty?: boolean;
	} = $props();

	let showPassword = $state(false);

	const fieldId = $derived(id ?? name);
	const errorId = $derived(`${fieldId}-error`);
	const describedById = $derived(`${fieldId}-description`);

	const fieldError = $derived($errors[name]);

	/** superforms nests errors under `_errors` for arrays and objects, and inlines them otherwise. */
	const messages = $derived.by<string[]>(() => {
		const raw = fieldError;
		if (!raw) return [];
		if (Array.isArray(raw)) return raw.map(String);

		const nested = (raw as { _errors?: unknown })._errors;
		if (Array.isArray(nested)) return nested.map(String);

		return [String(raw)];
	});

	const invalid = $derived(messages.length > 0);

	/*
	 * What the field is described by, in the order it should be read: the hint first, then
	 * whatever went wrong. Undefined rather than an empty string, so the attribute is absent
	 * instead of pointing at nothing.
	 */
	const describedBy = $derived(
		[description ? describedById : null, invalid ? errorId : null].filter(Boolean).join(' ') ||
			undefined
	);
</script>

<div class="flex w-full max-w-full flex-col justify-start gap-2 p-1">
	<Label for={fieldId} class="capitalize">{label}</Label>

	{#if type === 'textarea'}
		<Textarea
			id={fieldId}
			{name}
			{disabled}
			bind:value={$form[name]}
			{required}
			{rows}
			{placeholder}
			aria-invalid={invalid ? 'true' : undefined}
			aria-describedby={describedBy}
		/>
	{:else if type === 'file'}
		<FileUpload {name} {form} {image} {placeholder} {compress} />
	{:else if type === 'select'}
		<SelectComp {name} {label} bind:value={$form[name]} {items} />
	{:else if type === 'date'}
		<DatePicker
			bind:data={$form[name]}
			{oldDays}
			{year}
			{futureDays}
			allowEmpty={allowEmpty ?? !required}
		/>
		<input type="hidden" {name} bind:value={$form[name]} />
	{:else if type === 'dateMultiple'}
		<DateRangePicker bind:data={$form[name]} {oldDays} {year} {futureDays} />
		<input type="hidden" {name} bind:value={$form[name]} />
	{:else if type === 'combo'}
		<ComboboxComp {name} {label} bind:value={$form[name]} {items} {required} />
	{:else if type === 'checkbox'}
		<CheckboxComp {items} bind:checkedValues={$form[name]} />
		<input type="hidden" {name} bind:value={$form[name]} />
	{:else if type === 'checkboxSingle'}
		<div class="flex items-center gap-2">
			<Checkbox id={fieldId} bind:checked={$form[name]} {disabled} />
			<Label for={fieldId} class="capitalize">{placeholder}</Label>
			<input type="hidden" {name} bind:value={$form[name]} />
		</div>
	{:else if type === 'password'}
		<div class="relative">
			<Input
				id={fieldId}
				type={showPassword ? 'text' : 'password'}
				bind:value={$form[name]}
				{name}
				{required}
				{disabled}
				{placeholder}
				autocomplete="current-password"
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy}
				class="h-12 pr-24 font-mono text-base tracking-wide"
			/>
			<div class="absolute top-1/2 right-1 flex -translate-y-1/2 gap-1">
				<Button
					size="icon"
					variant="ghost"
					class="size-8 hover:bg-muted"
					aria-label={showPassword ? 'Hide password' : 'Show password'}
					aria-pressed={showPassword}
					onclick={() => (showPassword = !showPassword)}
				>
					{#if showPassword}
						<EyeOff class="size-4" />
					{:else}
						<Eye class="size-4" />
					{/if}
				</Button>
			</div>
		</div>
	{:else}
		<Input
			id={fieldId}
			{type}
			{name}
			bind:value={$form[name]}
			autocomplete="off"
			{max}
			{disabled}
			{min}
			{placeholder}
			{required}
			step={type === 'number' ? (step ?? 'any') : undefined}
			aria-invalid={invalid ? 'true' : undefined}
			aria-describedby={describedBy}
		/>
	{/if}

	{#if description}
		<p id={describedById} class="text-xs text-muted-foreground">{description}</p>
	{/if}

	{#if invalid}
		<!-- `role="alert"` so the message is announced when it appears, not only when focused. -->
		<div id={errorId} role="alert" class="flex flex-col gap-1">
			{#each messages as error (error)}
				<p class="flex items-center gap-2 text-red-500">
					<CircleAlert class="size-4 shrink-0" />
					{error}
				</p>
			{/each}
		</div>
	{/if}
</div>
