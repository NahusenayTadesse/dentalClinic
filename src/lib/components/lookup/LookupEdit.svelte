<script lang="ts">
	import { SquarePen, Save } from '@lucide/svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';

	import { Button } from '$lib/components/ui/button/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import Messages from '$lib/formComponents/Messages.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import LookupFields from './LookupFields.svelte';
	import type { LookupField, LookupOptions, LookupRow } from './types';
	import type { LookupForm } from './columns';

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
		options
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
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	let open = $state(false);

	/*
	 * Seeded once, on creation. The dialog is rendered per row, so each instance gets its own
	 * row — there is nothing here for a `$derived` to track.
	 */
	$form.id = row.id;
	for (const field of fields) $form[field.name] = row[field.name];

	const title = $derived(String(row[fields[0]?.name ?? 'name'] ?? ''));

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
				open = false;
			}
		}
	});
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

	<form {action} use:enhance method="post" id="edit" class="flex w-full flex-col gap-4 p-4">
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<Messages {message} />

		<LookupFields {fields} {form} {errors} {entity} {options} />

		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Saving Changes" />
			{:else}
				<Save class="h-4 w-4" /> Save Changes
			{/if}
		</Button>
	</form>
</DialogComp>
