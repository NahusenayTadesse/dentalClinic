<script lang="ts">
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { editIdentity, type EditIdentity } from './schema';
	const genders = [
		{ value: 'male', name: 'Male' },
		{ value: 'female', name: 'Female' }
	];

	let {
		data,
		firstName,
		fatherName,
		grandFatherName,
		image,
		govtIdPhoto,
		gender,
		birthDate,
		signature,
		pension,
		pensionCard
	}: {
		data: SuperValidated<EditIdentity>;
		firstName: string;
		fatherName: string;
		grandFatherName: string;
		image: string;
		pension: boolean;
		pensionCard?: string;
		signature?: string;
		govtIdPhoto: string;
		gender: string;
		birthDate: Date;
	} = $props();

	let open = $state(false);

	const { form, errors, enhance, delayed, allErrors } = createForm(data, editIdentity, {
		resetForm: false,
		invalidateAll: true,
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});

	$form.firstName = firstName;
	$form.fatherName = fatherName;
	$form.grandFatherName = grandFatherName;
	$form.gender = gender;
	$form.birthDate = birthDate.toLocaleDateString('en-CA');
	let image1 = signature ?? '';
	$form.existingPensionCard = pension;
	let image2 = pensionCard ?? '';
</script>

<DialogComp bind:open title="Edit" variant="default" IconComp={SquarePen}>
	<form
		id="main"
		action="?/editIdentity"
		class="flex w-full! min-w-full! flex-col items-center justify-center gap-3"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<InputComp label="Name" name="firstName" type="text" {form} {errors} required />
		<InputComp label="Father Name" name="fatherName" type="text" {form} {errors} required />
		<InputComp
			label="Grand Father Name"
			name="grandFatherName"
			type="text"
			{form}
			{errors}
			required
		/>
		<InputComp
			label="Gender"
			name="gender"
			type="select"
			{form}
			{errors}
			required
			items={genders}
		/>
		<InputComp label="Birth Date" name="birthDate" type="date" {form} {errors} required oldDays />
		<InputComp
			label="Photo"
			name="photo"
			type="file"
			{form}
			{errors}
			required={false}
			image={image ? image : ''}
		/>
		<InputComp
			label="Goverment Id"
			name="govtId"
			type="file"
			{form}
			{errors}
			required={false}
			image={govtIdPhoto ? govtIdPhoto : ''}
		/>

		<InputComp
			label="Signature"
			name="signature"
			{form}
			{errors}
			type="file"
			image={image1}
			placeholder="Upload a signature of Employee with good Quality, Max 10MB"
		/>

		<InputComp
			label="Existing Pension Card"
			name="existingPensionCard"
			placeholder="Enter TIN"
			{form}
			{errors}
			type="select"
			items={[
				{ value: false, name: 'No' },
				{ value: true, name: 'Yes' }
			]}
		/>

		{#if $form.existingPensionCard === true}
			<InputComp
				label="Pension Card Image or PDF"
				name="pensionCard"
				{form}
				{errors}
				type="file"
				image={image2}
				placeholder="Upload a recent photo of Pension Card"
			/>
		{/if}

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
