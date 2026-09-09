<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Plus, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';
	import type { EditExperience } from './schema';

	let {
		data,
		id,
		companyName,
		position,
		startDate,
		endDate,
		description,
		certificate,
		icon = false
	}: {
		data: SuperValidated<Infer<EditExperience>>;
		id: number;
		companyName: string;
		position: string;
		startDate: Date;
		endDate: Date;
		description?: string;
		certificate?: string;
		icon: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	let open = $state(false);

	$form.id = id;
	$form.companyName = companyName;
	$form.position = position;
	$form.description = description;
	$form.startDate = startDate?.toLocaleDateString('en-CA');
	$form.endDate = endDate?.toLocaleDateString('en-CA');

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { Item } from '$lib/global.svelte';
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

<DialogComp
	title="Edit {companyName}"
	variant="ghost"
	bind:open
	triggerClass="justify-self-start p-0!"
>
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
				{companyName}
			{/if}
		</Button>
	{/snippet}
	<form
		action="?/editExperience"
		use:enhance
		method="post"
		id="edit"
		class="flex h-96 w-full flex-col gap-4 p-4 pt-8"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<InputComp
			label="Company Name"
			name="companyName"
			type="text"
			{form}
			{errors}
			placeholder="Enter Company Name"
		/>
		<InputComp label="Position" name="position" type="text" {form} {errors} required />

		<InputComp
			label="Work and Experience Description"
			name="description"
			type="textarea"
			{form}
			{errors}
			required={false}
			rows={5}
			placeholder="Enter Work Experience"
		/>
		<InputComp
			label="Start Date"
			name="startDate"
			type="date"
			{form}
			{errors}
			oldDays
			futureDays={false}
			year
		/>

		<InputComp
			label="End Date"
			name="endDate"
			type="date"
			{form}
			{errors}
			oldDays
			futureDays={false}
			year
		/>

		<InputComp
			label="Certificate"
			name="certificate"
			type="file"
			image={certificate ? certificate : undefined}
			{form}
			{errors}
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
