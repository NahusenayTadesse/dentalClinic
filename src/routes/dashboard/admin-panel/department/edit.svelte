<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Edit } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';

	type Item = {
		value: number;
		name: string;
	};

	let {
		data,
		action = '?/edit',
		id,
		name,

		commission,
		description,
		icon = false,
		status = true
	}: {
		data: SuperValidated<Infer<Edit>>;
		action: string;
		id: number;
		name: string;
		icon: boolean;

		commission: boolean;
		description: string;
		status: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		onUpdated({ form }) {
			if (form.message) {
				if (form.message) {
					if (form.message.type === 'error') {
						toast.error(form.message.text);
					} else {
						toast.success(form.message.text);
					}
				}
			}
		},
		resetForm: false
	});

	let open = $state(false);

	$form.id = id;
	$form.name = name;

	$form.commission = commission;
	$form.description = description;
	$form.status = status;

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	// $effect(() => {
	// 	if ($message) {
	// 		if ($message.type === 'error') {
	// 			toast.error($message.text);
	// 		} else {
	// 			toast.success($message.text);
	// 			open = false;
	// 		}
	// 	}
	// });
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
		<InputComp {form} {errors} label="name" type="text" name="name" required={true} />

		<InputComp
			{form}
			{errors}
			label="Calculate Commission for this department's employees"
			type="select"
			name="commission"
			placeholder="Enter Department Commission"
			items={[
				{ value: true, name: 'Calculate Commission for this department' },
				{ value: false, name: 'Do Not Calculate Commission for this department' }
			]}
		/>
		<InputComp
			{form}
			{errors}
			label="Description"
			type="textarea"
			name="description"
			placeholder="Enter Department Description"
			rows={10}
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
