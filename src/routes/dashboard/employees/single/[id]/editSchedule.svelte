<script lang="ts">
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { getWeekdayName } from '$lib/global.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';

	import type { SuperValidated } from 'sveltekit-superforms';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import { editSchedule, type EditSchedule } from './schema';
	const weekDays = [
		{ value: 0, name: 'Monday' },
		{ value: 1, name: 'Tuesday' },
		{ value: 2, name: 'Wednesday' },
		{ value: 3, name: 'Thursday' },
		{ value: 4, name: 'Friday' },
		{ value: 5, name: 'Saturday' },
		{ value: 6, name: 'Sunday' }
	];

	let {
		data,
		id,
		startTime,
		endTime,
		weekDay,
		status,
		icon = false
	}: {
		data: SuperValidated<EditSchedule>;
		id: number;
		startTime: string;
		endTime: string;
		weekDay: number;
		status: boolean;
		icon: boolean;
	} = $props();

	const { form, errors, enhance, delayed, allErrors } = createForm(data, editSchedule, {
		resetForm: false,
		// Closed only on success, so a rejected save keeps the dialog and its errors on screen.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});

	let open = $state(false);

	$form.id = id;
	$form.weekDay = weekDay;
	$form.startTime = startTime;
	$form.endTime = endTime;
	$form.status = status;

	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import type { Item } from '$lib/global.svelte';
</script>

<DialogComp
	title="Edit {getWeekdayName(weekDay)}"
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
				{getWeekdayName(weekDay)}
			{/if}
		</Button>
	{/snippet}
	<form
		action="?/editSchedule"
		use:enhance
		method="post"
		id="edit"
		class="flex h-96 w-full flex-col gap-4 p-4 pt-8"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<InputComp label="Day" name="weekDay" type="select" {form} {errors} items={weekDays} />
		<InputComp label="Start Time" name="startTime" type="time" {form} {errors} required />
		<InputComp label="End Time" name="endTime" type="time" {form} {errors} required />
		<InputComp
			label="Status"
			name="status"
			type="select"
			{form}
			{errors}
			items={[
				{ value: true, name: 'Active' },
				{ value: false, name: 'Inactive' }
			]}
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
