<script lang="ts">
	import { type Item } from '$lib/global.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { type EditEmployment } from './schema';
	import { Button } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';

	let {
		data,
		employmentStatus,
		educationalLevel,
		hireDate,
		leavesLeft,
		employmentStatusList,
		educationalLevelList
	}: {
		data: SuperValidated<Infer<EditEmployment>>;
		employee: string;
		employmentStatus: number;

		leavesLeft: number;
		educationalLevel: number;
		hireDate: Date;
		statusList: Item[];

		employmentStatusList: Item[];
		educationalLevelList: Item[];
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
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

	// $form.idNo = idNo;

	$form.employmentStatus = employmentStatus;
	$form.educationalLevel = educationalLevel;

	$form.hireDate = hireDate;
	$form.leavesLeft = leavesLeft;
</script>

<DialogComp title="Edit" variant="default" class="" IconComp={SquarePen}>
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
