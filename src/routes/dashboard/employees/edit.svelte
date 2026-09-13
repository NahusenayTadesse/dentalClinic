<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button/index.js';
	import { edit, type Edit } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { SuperValidated } from 'sveltekit-superforms';
	import { createForm } from '$lib/forms/createForm';
	import Errors from '$lib/formComponents/Errors.svelte';

	let {
		data,
		id,
		name,
		count
	}: {
		data: SuperValidated<Edit>;
		id: number;
		name: string;
		count: number;
	} = $props();
	let open = $state(false);
	import InputComp from '$lib/formComponents/InputComp.svelte';

	/*
	 * This form previously passed no validator at all, so nothing was checked until the round trip
	 * came back. `createForm` wires the schema and the toast; the hand-rolled `$effect` watching
	 * `$message` that used to sit here is what §13 replaced.
	 */
	const { form, errors, enhance, delayed, allErrors } = createForm(data, edit, {
		onUpdate({ result }) {
			// Close only on success, so a rejected submit leaves the dialog and its errors in place.
			if (result.type === 'success') open = false;
		},
		resetForm: false
	});

	// An effect rather than a one-off assignment: the dialog is reused across rows, and a plain
	// `$form.id = id` captures whichever row happened to mount it first (§4).
	$effect(() => {
		$form.id = id;
	});
</script>

<DialogComp
	title="Add Missing Days for {name}"
	variant="ghost"
	bind:open
	triggerClass="justify-self-start p-0!"
>
	{#snippet trigger(props)}
		<Button
			size="sm"
			variant="ghost"
			class="flex w-auto flex-row items-center justify-center gap-2 justify-self-start border-0 p-0!"
			{...props}
		>
			{count}

			Add Days
		</Button>
	{/snippet}
	<form
		action="?/addDays"
		use:enhance
		method="post"
		id="edit"
		class="flex w-full flex-col gap-4 p-4"
	>
		<Errors allErrors={$allErrors} />
		<input bind:value={$form.id} name="id" type="hidden" />

		<InputComp
			{form}
			{errors}
			label="Missing Days"
			type="dateMultiple"
			name="day"
			placeholder="Enter the dates employee was misisng"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="Reason"
			type="textarea"
			name="reason"
			placeholder="Enter reason"
			required={true}
		/>

		<InputComp
			label="Is this missing days deductable from employee's salary?"
			name="deductable"
			type="select"
			{form}
			{errors}
			items={[
				{ value: true, name: '-Deductable' },
				{ value: false, name: '+Not Deductable' }
			]}
		/>
		{#if $form.deductable}
			<InputComp
				label="Deductable Amount per day"
				name="deductableAmount"
				type="text"
				{form}
				{errors}
			/>
		{/if}

		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Adding Missing Days" />
			{:else}
				<Plus class="h-4 w-4" />

				Add Missing Days
			{/if}
		</Button>
	</form>
</DialogComp>
