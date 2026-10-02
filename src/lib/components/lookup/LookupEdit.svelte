<script lang="ts">
	import { SquarePen, Save } from '@lucide/svelte';
	import { createForm } from '$lib/forms/createForm';

	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import Messages from '$lib/formComponents/Messages.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import LookupFields from './LookupFields.svelte';
	import type { LookupField, LookupOptions, LookupRow } from './types';
	import type { LookupForm, LookupSchema } from './columns';

	/**
	 * The edit dialog for one lookup row.
	 *
	 * Rendered twice per row: once as the name cell (`icon: false`, the name itself is the
	 * trigger) and once as the Edit column (`icon: true`). That is how these pages already
	 * worked; it is preserved here so the tables look unchanged.
	 */
	let {
		row,
		fields,
		entity,
		data,
		action = '?/edit',
		icon = false,
		options,
		schema,
		label
	}: {
		row: LookupRow;
		fields: LookupField[];
		entity: string;
		/** The `editForm` from the load, already validated against the route's edit schema. */
		data: LookupForm;
		action?: string;
		icon?: boolean;
		/** Options for every `reference` field, keyed by field name. */
		options?: LookupOptions;
		/** The edit schema, so the dialog checks a field before the round trip. */
		schema?: LookupSchema;
		/**
		 * What the trigger and the title say. The first field's raw value is the default, which is
		 * wrong for a reference — a patient's allergy row read "22" instead of "Latex".
		 */
		label?: string;
	} = $props();

	let open = $state(false);

	// Seeded once per row: the dialog is rendered per row, so there is no later value to follow.
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message, allErrors } = createForm(data, schema, {
		/*
		 * One id per dialog. Every row's dialogs were built from the same `editForm`, so they shared
		 * its id — two per row, twenty on an allergy list — and superforms delivers a save's reply to
		 * every form with the id it came from. The id is posted with the form and echoed back, so a
		 * unique one is what keeps a save on one row from landing in the others.
		 */
		id: `${action}-${row.id}-${icon ? 'column' : 'name'}`,
		resetForm: false,
		// Closed only on success, so a refused save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});

	/*
	 * Seeded once, on creation. The dialog is rendered per row, so each instance gets its own
	 * row — there is nothing here for a `$derived` to track.
	 */
	$form.id = row.id;
	for (const field of fields) $form[field.name] = row[field.name];

	/*
	 * Unique per row and per action. Every dialog here used `id="edit"`, and the submit button
	 * finds its form by that id — harmless with one table on a page, but a detail page hosts
	 * several, and a button pointing at the first `#edit` in the document submits somebody else's
	 * form.
	 */
	const formId = $derived(`${action}-${row.id}`);

	const title = $derived(label ?? String(row[fields[0]?.name ?? 'name'] ?? ''));
</script>

<DialogComp title="Edit {title}" variant="ghost" bind:open triggerClass="justify-self-start p-0!">
	{#snippet trigger(props)}
		<Button
			size="sm"
			variant="ghost"
			class="flex w-auto flex-row items-center justify-center gap-2 justify-self-start border-0 p-0!"
			{...props}
		>
			{#if icon}
				<SquarePen /> Edit
			{:else}
				{title}
			{/if}
		</Button>
	{/snippet}

	<form {action} use:enhance method="post" id={formId} class="flex w-full flex-col gap-4 p-4">
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<Messages {message} />

		<LookupFields {fields} {form} {errors} {entity} {options} />

		<Button type="submit" class="mt-4" form={formId}>
			{#if $delayed}
				<LoadingBtn name="Saving Changes" />
			{:else}
				<Save class="h-4 w-4" /> Save Changes
			{/if}
		</Button>
	</form>
</DialogComp>
