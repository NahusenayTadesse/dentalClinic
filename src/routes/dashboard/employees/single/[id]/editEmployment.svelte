<script lang="ts">
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { type Item } from '$lib/global.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { editEmployment, type EditEmployment } from './schema';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import type { SuperValidated } from 'sveltekit-superforms';

	let {
		data,
		employmentStatus,
		educationalLevel,
		hireDate,
		leavesLeft,
		employmentStatusList,
		educationalLevelList
	}: {
		data: SuperValidated<EditEmployment>;
		employee: string;
		employmentStatus: number;

		leavesLeft: number;
		educationalLevel: number;
		hireDate: Date;
		statusList: Item[];

		employmentStatusList: Item[];
		educationalLevelList: Item[];
	} = $props();

	let open = $state(false);

	const { form, errors, enhance, delayed, allErrors } = createForm(data, editEmployment, {
		resetForm: false,
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});

	// $form.idNo = idNo;

	$form.employmentStatus = employmentStatus;
	$form.educationalLevel = educationalLevel;

	$form.hireDate = hireDate;
	$form.leavesLeft = leavesLeft;
</script>

<DialogComp bind:open title="Edit" variant="default" class="" IconComp={SquarePen}>
	<form
		id="main"
		action="?/editEmployment"
		class="flex w-full! min-w-full flex-col items-center justify-center gap-2"
		use:enhance
		method="post"
		enctype="multipart/form-data"
	>
		<!-- <InputComp label="Employee ID" name="idNo" type="text" {form} {errors} required /> -->

		<InputComp label="Leaves Left" name="leavesLeft" type="number" {form} {errors} required />

		<InputComp
			label="Educational Level"
			name="educationalLevel"
			type="select"
			{form}
			{errors}
			required
			items={educationalLevelList}
		/>
		<InputComp
			label="Employment Status"
			name="employmentStatus"
			type="select"
			{form}
			{errors}
			required
			items={employmentStatusList}
		/>
		<InputComp
			label="Hired Date"
			year
			futureDays={false}
			name="hireDate"
			type="date"
			{form}
			{errors}
			required
			oldDays
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
