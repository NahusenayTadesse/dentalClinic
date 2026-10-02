<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import type { edit as editSchema } from './schema';

	let {
		data,
		action = '?/edit',
		id,
		name,
		description,
		icon = false
	}: {
		data: SuperValidated<Infer<typeof editSchema>>;
		action?: string;
		id: number;
		name: string;
		description: string | null;
		icon?: boolean;
	} = $props();

	let open = $state(false);

	const { form, errors, enhance, delayed, allErrors } = superForm(data, {
		id: `edit-${id}`,
		onUpdated({ form: result }) {
			if (result.message) {
				if (result.message.type === 'error') toast.error(result.message.text);
				else {
					toast.success(result.message.text);
					open = false;
				}
			}
		},
		resetForm: false
	});

	$form.id = id;
	$form.name = name;
	$form.description = description ?? undefined;
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

	<form {action} use:enhance method="post" id="edit-{id}" class="flex w-full flex-col gap-4 p-4">
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />

		<InputComp
			{form}
			{errors}
			label="Name"
			type="text"
			name="name"
			required={true}
			placeholder="e.g. Machinery"
		/>

		<InputComp
			{form}
			{errors}
			label="Description"
			type="textarea"
			name="description"
			rows={4}
			placeholder="What belongs in this category"
		/>

		<Button type="submit" class="mt-4" form="edit-{id}">
			{#if $delayed}
				<LoadingBtn name="Saving Changes" />
			{:else}
				<Save class="h-4 w-4" />
				Save Changes
			{/if}
		</Button>
	</form>
</DialogComp>
