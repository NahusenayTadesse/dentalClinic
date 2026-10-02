<script lang="ts">
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { type Item } from '$lib/global.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { editPersonal, type EditPersonal } from './schema';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import type { SuperValidated } from 'sveltekit-superforms';
	const maritalStatuses = ['single', 'married', 'widowed', 'divorced', 'other'].map((v) => ({
		value: v,
		name: v.charAt(0).toUpperCase() + v.slice(1)
	}));
	const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({
		value: v,
		name: v
	}));
	let {
		data,
		tinNo,
		martialStatus,
		bloodType
	}: {
		// Was typed as the employment schema while posting to `editPersonal`, so the fields it
		// binds were checked against a shape this dialog does not submit.
		data: SuperValidated<EditPersonal>;
		tinNo: string;
		martialStatus: string;
		bloodType?: string;
	} = $props();

	let open = $state(false);

	const { form, errors, enhance, delayed, allErrors } = createForm(data, editPersonal, {
		resetForm: false,
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});

	$form.tinNo = tinNo;
	$form.martialStatus = martialStatus;
	$form.bloodType = bloodType || '';
</script>

<DialogComp bind:open title="Edit" variant="default" class="" IconComp={SquarePen}>
	<form
		id="main"
		action="?/editPersonal"
		class="flex w-full! min-w-full flex-col items-center justify-center gap-2"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<InputComp label="Tin Number" name="tinNo" type="text" {form} {errors} />

		<InputComp
			label="Martial Status   "
			name="martialStatus"
			type="select"
			{form}
			{errors}
			required
			items={maritalStatuses}
		/>
		<InputComp
			label="Blood Type"
			name="bloodType"
			type="select"
			{form}
			{errors}
			required={false}
			items={bloodTypes}
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
