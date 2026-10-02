<script lang="ts">
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';

	const isActives = [
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	];

	let { data } = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data.form, {
		resetForm: false,
		invalidateAll: true
	});
	import { toast } from 'svelte-sonner';
	import type { EditLeave } from './schema';
	import type { Item } from '$lib/global.svelte';
	import MonthYear from '@nahu/admin-kit/formComponents/MonthYear.svelte';
	import { computeLeaveDays, formatDays } from '$lib/leaveDays';

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
	$form.id = data?.id; // 1

	$form.requestDate = data?.requestDate.toLocaleDateString('en-CA'); // 3
	$form.startDate = data?.startDate.toLocaleDateString('en-CA'); // 3
	$form.endDate = data?.endDate.toLocaleDateString('en-CA'); // 3
	$form.leaveType = data?.leaveTypeId;
	$form.reason = data?.reason;
	$form.status = data?.status;
	$form.rejectionReason = data?.rejectionReason ?? '';
	$form.halfDayStart = data?.halfDayStart ?? false;
	$form.halfDayEnd = data?.halfDayEnd ?? false;

	// Same helper the server stores with, so this readout matches what gets recorded.
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
		(data?.leaveTypeList ?? []).find(
			(t: { value: number; maxDays?: number }) => t.value === $form.leaveType
		)?.maxDays ?? 0
	);
	let overAllowance = $derived(allowance > 0 && duration > allowance);

	let image = data?.leaveLetter ?? ''; //14
</script>

<DialogComp title="Edit Leave for {data?.name}" variant="ghost">
	{#snippet trigger(props)}
		<Button size="icon" variant="ghost" title="Edit Leave" {...props}>
			<SquarePen />
		</Button>
	{/snippet}
	<form
		use:enhance
		action="?/editLeave"
		id="main"
		class="flex flex-col gap-4"
		method="POST"
		enctype="multipart/form-data"
	>
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" id="" bind:value={$form.id} />
		<InputComp
			{form}
			{errors}
			label="Select Leave Status for {data.name}"
			type="select"
			name="status"
			items={[
				{ value: 'pending', name: 'Pending Approval' },
				{ value: 'approved', name: 'Approve Leave' },
				{ value: 'rejected', name: 'Reject Leave' }
			]}
		/>
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
			required={true}
			placeholder="Enter Reason for Leave"
		/>
		{#if $form.status === 'rejected'}
			<InputComp
				label="Rejection Reason"
				name="rejectionReason"
				type="textarea"
				{form}
				{errors}
				required={false}
				placeholder="Enter Rejection Reason"
			/>
		{/if}
		<InputComp
			label="Leave Letter File"
			name="leaveLetter"
			type="file"
			{form}
			{errors}
			{image}
			required={false}
			placeholder="Upload Leave Letter File in pdf or image format"
		/>

		<Button type="submit" class="mt-4" form="main">
			{#if $delayed}
				<LoadingBtn name="Save Leave for {data?.name}" />
			{:else}
				<Save class="h-4 w-4" />

				Save Changes for {data?.name}
			{/if}
		</Button>
	</form>
</DialogComp>
