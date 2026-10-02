<script lang="ts">
	import { createForm } from '$lib/forms/createForm';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { Plus } from '@lucide/svelte';
	import type { SuperValidated } from 'sveltekit-superforms';

	const relationShips = [
		{ value: 'mother', name: 'Mother' },
		{ value: 'father', name: 'Father' },
		{ value: 'spouse', name: 'Spouse' },
		{ value: 'brother', name: 'Brother' },
		{ value: 'sister', name: 'Sister' },
		{ value: 'son', name: 'Son' },
		{ value: 'daughter', name: 'Daughter' },
		{ value: 'other', name: 'Other' }
	];

	import { addGuarantor, type AddGuarantor } from './schema';

	let {
		data,
		subcityList
	}: {
		data: SuperValidated<AddGuarantor>;
		subcityList: Item[];
	} = $props();

	let open = $state(false);

	const { form, errors, enhance, delayed, allErrors } = createForm(data, addGuarantor, {
		// An add form starts empty again, so reopening it does not show the entry just saved.
		resetForm: true,
		invalidateAll: true,
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});
	import type { Item } from '$lib/global.svelte';
</script>

<DialogComp bind:open title="Add Guarantor" variant="default" IconComp={Plus}>
	<form
		id="main"
		action="?/addGuarantor"
		class="flex w-full! min-w-full! flex-col items-center justify-center gap-3"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<input type="hidden" name="id" bind:value={$form.id} />
		<InputComp
			label="Name"
			name="name"
			type="text"
			placeholder="Enter name"
			{form}
			{errors}
			required
		/>
		<InputComp
			label="Phone"
			name="phone"
			type="tel"
			placeholder="Enter phone number"
			{form}
			{errors}
			required
		/>
		<InputComp
			label="Email"
			name="email"
			type="email"
			placeholder="Enter email address"
			{form}
			{errors}
			required={false}
		/>
		<InputComp
			label="Job Type"
			name="jobType"
			type="text"
			placeholder="Enter job type"
			{form}
			{errors}
			required
		/>
		<InputComp
			label="Company"
			name="company"
			type="text"
			placeholder="Enter company name"
			{form}
			{errors}
			required
		/>
		<InputComp
			label="Salary"
			name="salary"
			type="text"
			placeholder="Enter salary"
			{form}
			{errors}
			required
		/>

		<InputComp
			label="Relationship to Employee"
			name="relationship"
			type="select"
			{form}
			{errors}
			items={relationShips}
			required
		/>

		{#if $form.relationship === 'other'}
			<InputComp
				label="Other Relationship"
				name="relation"
				type="text"
				placeholder="Enter other relationship"
				{form}
				{errors}
				required
			/>
		{/if}

		<InputComp
			label="Photo"
			name="photo"
			type="file"
			{form}
			{errors}
			placeholder="Upload a 3 X 4 photo of Guarantor"
		/>
		<InputComp
			label="Document"
			name="document"
			type="file"
			{form}
			{errors}
			placeholder="Upload a document related to Guarantor"
		/>
		<InputComp
			label="Goverment Id"
			name="govtId"
			type="file"
			{form}
			{errors}
			placeholder="Upload a government ID(FIDA) of Guarantor"
		/>
		<h4>Guarantor Address</h4>

		<InputComp label="Subcity" name="subcity" type="combo" {form} {errors} items={subcityList} />
		<InputComp
			label="Other Subcity"
			name="otherSubcity"
			type="text"
			{form}
			{errors}
			placeholder="Enter other subcity if applicable otherwise leave blank"
		/>
		<InputComp label="Street" name="street" type="text" {form} {errors} />
		<InputComp label="Kebele" name="kebele" type="text" {form} {errors} />
		<InputComp label="Building Name or Number" name="buildingNumber" type="text" {form} {errors} />
		<InputComp label="Floor" name="floor" type="number" {form} {errors} />
		<InputComp label="House Number" name="houseNumber" type="text" {form} {errors} />

		<Errors allErrors={$allErrors} />
		<Button type="submit" class="w-full" form="main" variant="default">
			{#if $delayed}
				<LoadingBtn name="Adding Guarantor" />
			{:else}
				<Plus class="h-4 w-4" />
				Add Guarantor
			{/if}
		</Button>
	</form>
</DialogComp>
