<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Edit } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';

	let {
		data,
		action = '?/edit',
		id,
		name,
		maxDays,
		deductsBalance,
		description,
		icon = false,
		status = true
	}: {
		data: SuperValidated<Infer<Edit>>;
		action: string;
		id: number;
		name: string;
		maxDays: number;
		deductsBalance: boolean;
		description: string;
		icon: boolean;
		status: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	let open = $state(false);

	$form.id = id;
	$form.name = name;
	$form.maxDays = maxDays;
	$form.deductsBalance = deductsBalance;
	$form.description = description;
	$form.status = status;

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
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

<DialogComp title="Edit {name}" variant="ghost" bind:open triggerClass="justify-self-start p-0!">
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
				{name}
			{/if}
		</Button>
	{/snippet}
	<form {action} use:enhance method="post" id="edit" class="flex w-full flex-col gap-4 p-4">
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<InputComp
			{form}
			{errors}
			label="Name"
			type="text"
			name="name"
			placeholder="Enter leave type name"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="Maximum Days Allowed"
			type="number"
			name="maxDays"
			placeholder="Enter maximum number of days"
			required={true}
		/>
		<InputComp
			label="Drawn From Accrued Balance"
			name="deductsBalance"
			type="select"
			{form}
			{errors}
			items={[
				{ value: false, name: 'No — granted on top of the balance' },
				{ value: true, name: 'Yes — spends accrued annual leave days' }
			]}
		/>
		<InputComp
			{form}
			{errors}
			label="Description"
			type="textarea"
			name="description"
			placeholder="Enter leave type description"
			rows={5}
		/>
		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			items={[
				{ value: true, name: 'Active' },
				{ value: false, name: 'Inactive' }
			]}
		/>

		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Saving Changes" />
			{:else}
				<Save class="h-4 w-4" />

				Save Changes
			{/if}
		</Button>
	</form>
</DialogComp>
