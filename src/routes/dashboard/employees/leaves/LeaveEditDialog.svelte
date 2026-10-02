<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { clinicDate } from '$lib/clinicTime';
	import { computeLeaveDays, formatDays } from '$lib/leaveDays';
	import { editLeave, type EditLeave } from '$lib/components/leaves/schema';
	import type { LeaveRow } from '$lib/components/leaves/columns';

	/**
	 * Changing one leave request — one dialog for the whole list, seeded from the row clicked.
	 *
	 * It used to be a dialog per row, each with its own form validated on the server for every row
	 * of the list, and each writing the row into its form as it was created — which went on showing
	 * the leave as it was when the page loaded.
	 */
	let {
		row,
		open = $bindable(false),
		data,
		leaveTypes
	}: {
		/** The leave being changed, or null before one is chosen. */
		row: LeaveRow | null;
		open?: boolean;
		data: SuperValidated<EditLeave>;
		/** Active leave types; `maxDays` 0 means the type has no limit. */
		leaveTypes: { value: number; name: string; maxDays: number | null }[];
	} = $props();

	const day = (value: string | Date) => clinicDate(value);

	const seed = $derived<Partial<EditLeave>>(
		row
			? {
					id: row.id,
					status: row.status ?? 'pending',
					requestDate: day(row.requestDate),
					startDate: day(row.startDate),
					endDate: day(row.endDate),
					leaveType: row.leaveTypeId ?? undefined,
					reason: row.reason ?? '',
					rejectionReason: row.rejectionReason ?? '',
					halfDayStart: row.halfDayStart ?? false,
					halfDayEnd: row.halfDayEnd ?? false
				}
			: {}
	);

	/** What a draft counts as — the same helper the server stores with, so the two agree. */
	function duration(values: EditLeave) {
		return values.startDate && values.endDate ? computeLeaveDays(values) : 0;
	}

	/** The chosen type's limit, mirroring the server's allowance check; 0 is no limit. */
	function allowance(values: EditLeave) {
		return leaveTypes.find((t) => t.value === Number(values.leaveType))?.maxDays ?? 0;
	}

	const STATUSES = [
		{ value: 'pending', name: 'Pending approval' },
		{ value: 'approved', name: 'Approved' },
		{ value: 'rejected', name: 'Rejected' }
	];
</script>

<FormDialog
	title="Change {row?.name ?? 'this'}’s leave"
	action="?/editLeave"
	{data}
	schema={editLeave}
	bind:open
	{seed}
	hideTrigger
	multipart
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="id" value={values.id} />
		<InputComp {form} {errors} label="Status" type="select" name="status" items={STATUSES} />
		<InputComp {form} {errors} label="Requested on" name="requestDate" type="date" required />
		<InputComp {form} {errors} label="First day" name="startDate" type="date" required />
		<InputComp {form} {errors} label="Last day" name="endDate" type="date" required />
		{#if values.startDate !== '' && values.startDate === values.endDate}
			<InputComp
				{form}
				{errors}
				label="Half day"
				name="halfDayStart"
				type="checkboxSingle"
				placeholder="This leave is a half day only"
			/>
		{:else}
			<InputComp
				{form}
				{errors}
				label="Half day on the first day"
				name="halfDayStart"
				type="checkboxSingle"
				placeholder="Only half of the first day is taken"
			/>
			<InputComp
				{form}
				{errors}
				label="Half day on the last day"
				name="halfDayEnd"
				type="checkboxSingle"
				placeholder="Only half of the last day is taken"
			/>
		{/if}
		{#if duration(values) > 0}
			<p class="text-sm text-muted-foreground">
				This leave counts as
				<span class="font-medium text-foreground">{formatDays(duration(values))}</span>.
			</p>
		{/if}
		{#if allowance(values) > 0 && duration(values) > allowance(values)}
			<p class="text-sm text-destructive">
				This leave type allows at most {formatDays(allowance(values))}.
			</p>
		{/if}
		<InputComp
			{form}
			{errors}
			label="Leave type"
			name="leaveType"
			type="select"
			items={leaveTypes}
			required
		/>
		<InputComp {form} {errors} label="Reason" name="reason" type="textarea" />
		{#if values.status === 'rejected'}
			<InputComp
				{form}
				{errors}
				label="Why it was rejected"
				name="rejectionReason"
				type="textarea"
				required={false}
			/>
		{/if}
		<InputComp
			{form}
			{errors}
			label="Leave letter"
			name="leaveLetter"
			type="file"
			image={row?.leaveLetter ?? ''}
			required={false}
			placeholder="A PDF or a picture of the letter"
		/>
	{/snippet}
</FormDialog>
