<script lang="ts" generics="T extends Record<string, unknown>">
	import { untrack, type Snippet } from 'svelte';
	import type { SuperForm, SuperValidated } from 'sveltekit-superforms';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import Save from '@lucide/svelte/icons/save';

	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm } from '$lib/forms/createForm';
	import DialogComp from './DialogComp.svelte';
	import Errors from './Errors.svelte';
	import LoadingBtn from './LoadingBtn.svelte';

	/**
	 * A dialog holding one form: the trigger, the form, its errors and its submit button.
	 *
	 * **Why it exists.** Every edit dialog on a detail page is that same shell around a different
	 * list of fields. The employee page has twenty of them, each re-declaring the dialog, the
	 * `createForm` call, the close-on-success handler, the error summary and the spinner — and the
	 * close-on-success handler was missing from sixteen, which is how saved dialogs came to sit open
	 * showing what had just been saved. The patient chart is the first page built on this instead.
	 *
	 * The fields are a snippet, handed the form's stores, so the caller writes only `InputComp`s:
	 *
	 *     <FormDialog title="Edit details" action="?/editIdentity" data={data.forms.identity} schema={editIdentity}>
	 *       {#snippet fields({ form, errors })}
	 *         <InputComp {form} {errors} name="name" label="Given name" />
	 *       {/snippet}
	 *     </FormDialog>
	 *
	 * **Opened from elsewhere.** By default the dialog brings its own "Edit" button. A page that
	 * opens it from something else — a tooth on the dental chart, a row in a table — binds `open`,
	 * hides the trigger, and passes `seed`: the values to start from, applied each time it opens.
	 * One dialog then serves every row, rather than a form per row.
	 *
	 * Non-goals: add dialogs over a table (that is `LookupSection`), and multi-step forms.
	 */
	let {
		title,
		action,
		data,
		schema,
		fields,
		description,
		submitLabel = 'Save changes',
		triggerLabel = 'Edit',
		disabled = false,
		open = $bindable(false),
		seed,
		hideTrigger = false,
		resetOnSuccess = false,
		files = false
	}: {
		title: string;
		/** The named action the form posts to, e.g. `?/editIdentity`. */
		action: string;
		data: SuperValidated<T>;
		/** The schema the action validates with, so fields are checked before the round trip. */
		schema: Parameters<typeof createForm>[1];
		/**
		 * The fields. `values` is the form's current data, for a field that depends on another —
		 * a snippet cannot subscribe to `$form` itself.
		 */
		fields: Snippet<[{ form: SuperForm<T>['form']; errors: SuperForm<T>['errors']; values: T }]>;
		description?: string;
		submitLabel?: string;
		triggerLabel?: string;
		/** Hide the dialog entirely — for a viewer who may read the section but not change it. */
		disabled?: boolean;
		/** Bind to open the dialog from outside it. */
		open?: boolean;
		/**
		 * Values written into the form each time the dialog opens — which tooth was clicked, which
		 * row is being edited. Read at the moment of opening, so changing it while the dialog is
		 * open does not overwrite what is being typed.
		 */
		seed?: Partial<T>;
		/** No trigger button: the page opens the dialog itself through `open`. */
		hideTrigger?: boolean;
		/**
		 * Clear the form after a successful save. For an add dialog used again and again; an edit
		 * dialog keeps what was saved, which is what the default does.
		 */
		resetOnSuccess?: boolean;
		/** The fields include a file: posted as multipart, which a file needs to arrive at all. */
		files?: boolean;
	} = $props();

	// Seeded once from the load; after a save superforms replaces it with what the server returned.
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data, schema, {
		resetForm: resetOnSuccess,
		// Closed only on success, so a refused save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});

	// Seeded on opening only: `seed` is read untracked, so a new seed while the dialog is open is
	// ignored until the next time it opens.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			if (seed) form.update((current) => ({ ...current, ...seed }), { taint: false });
		});
	});

	/* One id per action: several of these share a page, and the submit button finds its form by id. */
	const formId = $derived(`form-${action.replace(/\W/g, '')}`);
</script>

{#if !disabled}
	<DialogComp bind:open {title} {description} variant="ghost" triggerClass="ml-auto">
		{#snippet trigger(props)}
			{#if !hideTrigger}
				<Button size="sm" variant="ghost" class="ml-auto gap-1" {...props}>
					<SquarePen class="size-4" />
					{triggerLabel}
				</Button>
			{/if}
		{/snippet}

		<form
			{action}
			method="post"
			enctype={files ? 'multipart/form-data' : undefined}
			use:enhance
			id={formId}
			class="flex w-full flex-col gap-4 p-4"
		>
			<Errors allErrors={$allErrors} />

			{@render fields({ form, errors, values: $form })}

			<Button type="submit" form={formId} class="mt-2">
				{#if $delayed}
					<LoadingBtn name="Saving" />
				{:else}
					<Save class="size-4" />
					{submitLabel}
				{/if}
			</Button>
		</form>
	</DialogComp>
{/if}
