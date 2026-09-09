<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Plus, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { EditSites } from './schema';

	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let {
		data,
		id,
		name,
		phone,
		startDate,
		endDate,
		status,
		icon
	}: {
		data: SuperValidated<Infer<EditSites>>;
		id: number;
		name: string;
		phone: string;
		startDate: Date;
		endDate: Date;
		status: boolean;
		icon: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false,
		invalidateAll: true
	});
	import { toast } from 'svelte-sonner';
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
	$form.name = name;
	$form.phone = phone;
	$form.startDate = startDate.toLocaleDateString('en-CA');
	$form.startDate = endDate.toLocaleDateString('en-CA');
	$form.status = status;
</script>

<DialogComp title="Edit {name}" variant="ghost" triggerClass="justify-self-start p-0!">
	{#snippet trigger(props)}
		<Button
			size="sm"
			variant="ghost"
			class="flex flex-row items-center justify-center gap-2 justify-self-start border-0 p-0!"
			{...props}
		>
			{#if icon}
				<SquarePen /> Edit
			{:else}
				{name?.toUpperCase()}
			{/if}
		</Button>
	{/snippet}
	<form
		id="main"
		action="?/editSite"
		class="flex w-full! min-w-full! flex-col items-center justify-center gap-3"
		use:enhance
		method="post"
	>
		<input hidden bind:value={$form.id} name="id" />
		<InputComp
			label="Name"
			name="name"
			type="text"
			{form}
			{errors}
			placeholder="Enter Site Name"
			required
		/>
		<InputComp
			label="Phone"
			name="phone"
			type="tel"
			{form}
			{errors}
			placeholder="Enter Site Phone Number"
			required
		/>
		<InputComp label="Start Date" name="startDate" type="date" {form} {errors} required />
		<InputComp label="End Date" name="endDate" type="date" {form} {errors} required />

		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			required
			items={isActives}
		/>

		<Errors allErrors={$allErrors} />
		<Button type="submit" class="w-full" form="main" variant="default">
			{#if $delayed}
				<LoadingBtn name="Saving Changes" />
			{:else}
				<Save class="h-4 w-4" />
				Save Changes
			{/if}
		</Button>
	</form>
</DialogComp>
