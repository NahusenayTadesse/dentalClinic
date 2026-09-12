<script lang="ts">
	import { createForm, confirmLeave } from '$lib/forms/createForm';
	import type { Snapshot } from '@sveltejs/kit';

	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { page } from '$app/state';

	import { Plus, ArrowBigLeft } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { addLeave as schema } from './schema';
	import Errors from '$lib/formComponents/Errors.svelte';
	import { computeLeaveDays, formatDays } from '$lib/leaveDays';

	let { data } = $props();

	const { form, errors, enhance, delayed, allErrors, capture, restore } = createForm(
		data.form,
		schema,
		{
			taintedMessage: confirmLeave
		}
	);

	export const snapshot: Snapshot = { capture, restore };

	import FormCard from '$lib/formComponents/FormCard.svelte';

	// Same helper the server stores with, so the figure shown here is the figure recorded.
	let duration = $derived(
		$form.startDate && $form.endDate
			? computeLeaveDays({
					startDate: $form.startDate,
					endDate: $form.endDate,
					halfDayStart: $form.halfDayStart,
					halfDayEnd: $form.halfDayEnd
				})
			: 0
	);

	// The two flags land on the same day when the leave is a single day, so only one is offered.
	let singleDay = $derived($form.startDate !== '' && $form.startDate === $form.endDate);

	// Mirrors the server's allowance check so an over-long request is visible before submitting.
	// A maxDays of 0 means the type has no configured limit.
	let allowance = $derived(
		(data?.leaveTypeList ?? []).find((t) => t.value === $form.leaveType)?.maxDays ?? 0
	);
	let overAllowance = $derived(allowance > 0 && duration > allowance);
</script>

<svelte:head>
	<title>Add New Customer</title>
</svelte:head>

<Button href="/dashboard/employees/single/{page.params.id}" class="mb-6"
	><ArrowBigLeft /> Back to {data?.staffMember?.firstName}</Button
>

<FormCard
	title="Leave for {data?.staffMember?.firstName} {data?.staffMember?.fatherName}"
	description="Add a leave for {data?.staffMember?.firstName} {data?.staffMember?.fatherName}"
>
	<form
		use:enhance
		action="?/addLeave"
		id="main"
		class="flex flex-col gap-4"
		method="POST"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />

		<InputComp
			label="Leave Request Date"
			name="requestDate"
			type="date"
			{form}
			{errors}
			required={true}
			placeholder="Enter Leave Request Date"
		/>
		<InputComp
			label="Leave Start Date"
			name="startDate"
			type="date"
			{form}
			{errors}
			required={true}
			placeholder="Enter Leave Start Date"
		/>
		<InputComp
			label="Leave End Date"
			name="endDate"
			type="date"
			{form}
			{errors}
			required={true}
			placeholder="Enter Leave End Date"
		/>

		{#if singleDay}
			<InputComp
				label="Half Day"
				name="halfDayStart"
				type="checkboxSingle"
				{form}
				{errors}
				required={false}
				placeholder="This leave is a half day only"
			/>
		{:else}
			<InputComp
				label="Half Day on Start Date"
				name="halfDayStart"
				type="checkboxSingle"
				{form}
				{errors}
				required={false}
				placeholder="Only half of the first day is taken"
			/>
			<InputComp
				label="Half Day on End Date"
				name="halfDayEnd"
				type="checkboxSingle"
				{form}
				{errors}
				required={false}
				placeholder="Only half of the last day is taken"
			/>
		{/if}

		{#if duration > 0}
			<p class="text-sm text-muted-foreground">
				This leave counts as <span class="font-medium text-foreground">{formatDays(duration)}</span>
				.
			</p>
		{/if}

		{#if overAllowance}
			<p class="text-sm text-destructive">
				This leave type allows at most {formatDays(allowance)}.
			</p>
		{/if}

		<InputComp
			label="Leave Type"
			name="leaveType"
			type="select"
			{form}
			{errors}
			required={true}
			placeholder="Select Leave Type"
			items={data?.leaveTypeList ?? []}
		/>
		<InputComp
			label="Reason"
			name="reason"
			type="textarea"
			{form}
			{errors}
			required={false}
			placeholder="Enter Reason for Leave"
		/>
		<InputComp
			label="Leave Letter File"
			name="leaveLetter"
			type="file"
			{form}
			{errors}
			required={false}
			placeholder="Upload Leave Letter File in pdf or image format"
		/>

		<Button type="submit" class="mt-4" form="main">
			{#if $delayed}
				<LoadingBtn
					name="Adding Leave for {data?.staffMember?.firstName} {data?.staffMember?.fatherName}"
				/>
			{:else}
				<Plus class="h-4 w-4" />

				Add leave for {data?.staffMember?.firstName}
				{data?.staffMember?.fatherName}
			{/if}
		</Button>
	</form>
</FormCard>
