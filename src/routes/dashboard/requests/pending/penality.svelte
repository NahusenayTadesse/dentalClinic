<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Plus, Save, SquarePenIcon } from '@lucide/svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import type { AddRequest } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';

	let {
		data,
		ids,
		employees
	}: {
		data: SuperValidated<AddRequest>;
		/** Every request row on this invoice — decided together. */
		ids: number[];
		employees: Item[];
	} = $props();

	// The first row's id names the form. Invoice numbers carry characters that are
	// awkward in a CSS selector, and an id is unique to exactly one invoice anyway.
	const formId = $derived(`request-${ids[0]}`);
	let open = $state(false);
	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { Item } from '$lib/global.svelte';
	import { idsField } from '../receipts';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
	$form.ids = idsField(ids);
</script>

<form
	use:enhance
	method="post"
	class="w-lg"
	action="?/request"
	id={formId}
	enctype="multipart/form-data"
>
	<Errors allErrors={$allErrors} />
	{#if $message}
		<p class="text-sm text-zinc-500">{@html $message.text}</p>
	{/if}
	<input bind:value={$form.ids} name="ids" type="hidden" />
	<InputComp
		{form}
		{errors}
		type="select"
		label="Status"
		name="status"
		items={[
			{ value: 'approved', name: 'Approved' },
			{ value: 'rejected', name: 'Rejected' }
		]}
	/>

	<InputComp type="combo" label="Authorizer" name="approvedBy" {form} {errors} items={employees} />

	{#if $form.status === 'rejected'}
		<InputComp type="textarea" label="Rejected Reason" name="rejectedReason" {form} {errors} />
	{/if}

	<Button type="submit" class="w-full" form={formId} variant="default">
		{#if $delayed}
			<LoadingBtn name="Saving Changes" />
		{:else}
			<Save class="h-4 w-4" />
			Change Status
		{/if}
	</Button>
</form>
