<script lang="ts">
	import { createForm } from '$lib/forms/createForm';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
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

	import { editGuarantor, type EditGuarantor } from './schema';

	let {
		data,
		name,
		phone,
		email,
		relationship,
		relation,
		jobType,
		company,
		salary,
		photo,
		document,
		govtId,
		id
	}: {
		data: SuperValidated<EditGuarantor>;
		name: string;
		phone: string;
		email?: string;
		relationship: string;
		relation?: string;
		jobType: string;
		company: string;
		salary: string;
		photo?: string;
		document?: string;
		govtId?: string;
		id: number;
	} = $props();

	let open = $state(false);

	const { form, errors, enhance, delayed, allErrors } = createForm(data, editGuarantor, {
		resetForm: false,
		invalidateAll: true,
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});
	$form.id = id;
	$form.name = name;
	$form.phone = phone;
	$form.email = email ? email : undefined;
	$form.relationship = relationship;
	$form.relation = relation;
	$form.jobType = jobType;
	$form.company = company;
	$form.salary = salary;
</script>

<DialogComp bind:open title="Edit" variant="default" IconComp={SquarePen}>
	<form
		id="main"
		action="?/editGuarantor"
		class="flex w-full! min-w-full! flex-col items-center justify-center gap-3"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<input type="hidden" name="id" bind:value={$form.id} />
		<InputComp label="Name" name="name" type="text" {form} {errors} required />
		<InputComp label="Phone" name="phone" type="tel" {form} {errors} required />
		<InputComp label="Email" name="email" type="email" {form} {errors} />
		<InputComp label="Job Type" name="jobType" type="text" {form} {errors} required />
		<InputComp label="Company" name="company" type="text" {form} {errors} required />
		<InputComp label="Salary" name="salary" type="text" {form} {errors} required />

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
			<InputComp label="Other Relationship" name="relation" type="text" {form} {errors} required />
		{/if}

		<InputComp
			label="Photo"
			name="photo"
			type="file"
			image={photo ? photo : ''}
			{form}
			{errors}
			required
		/>
		<InputComp
			label="Document"
			name="document"
			type="file"
			image={document ? document : ''}
			{form}
			{errors}
			required
		/>
		<InputComp
			label="Goverment Id"
			name="govtId"
			type="file"
			image={govtId ? govtId : ''}
			{form}
			{errors}
			required
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
