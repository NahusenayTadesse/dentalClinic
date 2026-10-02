<script lang="ts">
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { SquarePen, Plus, Save } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';

	import type { SuperValidated } from 'sveltekit-superforms';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import { editQualification, type EditQualification } from './schema';

	let {
		data,
		id,
		field,
		educationLevel,
		schoolName,
		graduationDate,
		eduLevel,
		certificate,
		icon = false
	}: {
		data: SuperValidated<EditQualification>;
		id: number;
		field: string;
		schoolName: string;
		educationLevel: number;
		graduationDate: Date;
		certificate?: string;
		eduLevel: Item[];
		icon: boolean;
	} = $props();

	const { form, errors, enhance, delayed, allErrors } = createForm(data, editQualification, {
		resetForm: false,
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});

	let open = $state(false);

	$form.id = id;
	$form.field = field;
	$form.schoolName = schoolName;
	$form.educationLevel = educationLevel;
	$form.graduationDate = graduationDate?.toLocaleDateString('en-CA');

	import InputComp from '$lib/formComponents/InputComp.svelte';
	import type { Item } from '$lib/global.svelte';
</script>

<DialogComp title="Edit {field}" variant="ghost" bind:open triggerClass="justify-self-start p-0!">
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
				{field}
			{/if}
		</Button>
	{/snippet}
	<form
		action="?/editQualification"
		use:enhance
		method="post"
		id="edit"
		class="flex h-96 w-full flex-col gap-4 p-4 pt-8"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<InputComp
			label="Field"
			name="field"
			type="text"
			{form}
			{errors}
			placeholder="Enter Field Name"
		/>
		<InputComp
			label="Educational Level"
			name="educationLevel"
			type="combo"
			{form}
			{errors}
			items={eduLevel}
			required
		/>

		<InputComp
			label="School Name "
			name="schoolName"
			type="text"
			{form}
			{errors}
			required
			placeholder="Enter School Name"
		/>
		<InputComp
			label="Graduation Date"
			name="graduationDate"
			type="date"
			{form}
			{errors}
			oldDays
			futureDays={false}
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
