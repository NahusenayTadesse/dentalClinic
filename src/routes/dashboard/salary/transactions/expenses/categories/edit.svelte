<script lang="ts">
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import type { Edit } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { SuperValidated } from 'sveltekit-superforms';
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
		description,
		icon = false
	}: {
		data: SuperValidated<Edit>;
		action: string;
		id: number;
		name: string;
		icon: boolean;
		description: string;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	let open = $state(false);

	$form.id = id;
	$form.name = name;

	$form.description = description;

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
		<InputComp {form} {errors} label="name" type="text" name="name" required={true} />

		<InputComp
			{form}
			{errors}
			label="Description"
			type="textarea"
			name="description"
			placeholder="Enter Department Description"
			required={true}
			rows={10}
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
