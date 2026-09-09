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
		fromYears,
		toYears,
		days,
		description,
		label,
		icon = false,
		status = true
	}: {
		data: SuperValidated<Infer<Edit>>;
		action: string;
		id: number;
		fromYears: number;
		toYears: number | null;
		days: number;
		description: string;
		label: string;
		icon: boolean;
		status: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	let open = $state(false);

	$form.id = id;
	$form.fromYears = fromYears;
	$form.toYears = toYears;
	$form.days = days;
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

<DialogComp title="Edit {label}" variant="ghost" bind:open triggerClass="justify-self-start p-0!">
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
				{label}
			{/if}
		</Button>
	{/snippet}
	<form {action} use:enhance method="post" id="edit" class="flex w-full flex-col gap-4 p-4">
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<InputComp
			{form}
			{errors}
			label="From Year of Service"
			type="number"
			name="fromYears"
			placeholder="e.g. 1"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="To Year of Service"
			type="number"
			name="toYears"
			placeholder="Leave empty for this year and above"
		/>
		<InputComp
			{form}
			{errors}
			label="Leave Days Granted Per Year"
			type="number"
			name="days"
			placeholder="e.g. 16"
			required={true}
		/>
		<InputComp
			{form}
			{errors}
			label="Description"
			type="textarea"
			name="description"
			placeholder="Enter a note about this bracket"
			rows={4}
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
