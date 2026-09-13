<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Edit } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';

	let {
		data,
		id,
		name,
		count,
		days
	}: {
		data: SuperValidated<Edit>;
		id: number;
		name: string;
		count: number;
		days?: string;
	} = $props();
	let open = $state(false);
	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		onUpdate({ result }) {
			if (result.type === 'success') {
				open = false; // This will now trigger correctly
			}
		},
		resetForm: false
	});

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
	$form.id = id;

	if (days) {
		$form.day = days;
		$form.oldDays = days;
	}
</script>

<DialogComp
	title="{days ? 'Edit Missing Days for ' : 'Add Missing Days for '} {name}"
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

			{days ? 'Edit' : 'Add'} Days
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
		<InputComp {form} {errors} label="" name="id" type="hidden" />
		<input bind:value={$form.oldDays} name="oldDays" type="hidden" />

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
