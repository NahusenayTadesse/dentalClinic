<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CalendarCheck from '@lucide/svelte/icons/calendar-check';
	import Plus from '@lucide/svelte/icons/plus';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Smile from '@lucide/svelte/icons/smile';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import { addClinicDays } from '$lib/clinicTime';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { ORTHO_STATUS_LABEL } from '$lib/orthoPlan';
	import CaseSummary from '../CaseSummary.svelte';
	import { newVisit } from '../schema';
	import { instalmentColumns } from './columns';

	/**
	 * One orthodontic case: the summary, the steps it can take next, the adjustment visits newest
	 * first with when the patient is due back, and the payment plan with each instalment's bill.
	 */
	let { data } = $props();

	let visitOpen = $state(false);
	const c = $derived(data.case);
	const columns = $derived(instalmentColumns(data.patient.id));
	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
	const MOVE_WORDS = {
		active: '',
		retention: 'Braces off — retention',
		finished: 'Finish the case',
		discontinued: 'Discontinue'
	} as const;
</script>

<svelte:head>
	<title>{data.patient.fullName} — Orthodontic case</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center gap-2">
		<Button href="/dashboard/patients/{data.patient.id}/ortho" variant="ghost" size="sm">
			<ArrowLeft class="size-4" /> All cases
		</Button>
		<div class="ml-auto flex flex-wrap gap-2">
			{#if data.canBill && c.dueUnbilled && c.status !== 'discontinued'}
				<StepButton
					id="bill-due"
					action="?/bill"
					data={data.forms.step}
					label="Bill what is due ({c.dueUnbilled})"
					icon={Receipt}
					variant="default"
				/>
			{/if}
			{#if data.canWrite}
				{#each data.next as status (status)}
					<StepButton
						id="move-{status}"
						action="?/move"
						data={data.forms.move}
						values={{ status }}
						label={MOVE_WORDS[status]}
						variant={status === 'discontinued' ? 'ghost' : 'outline'}
						confirm={status === 'retention'
							? undefined
							: {
									title: `${ORTHO_STATUS_LABEL[status]}?`,
									description:
										status === 'discontinued'
											? 'Instalments not yet billed are cancelled; billed ones are still owed. The case takes no more visits.'
											: 'The case is closed and takes no more visits.',
									action: MOVE_WORDS[status]
								}}
					/>
				{/each}
			{/if}
		</div>
	</div>

	<Section title="The case" IconComp={Smile} style="identityIcon">
		<CaseSummary {c} />
		{#if c.notes}<p class="mt-3 text-sm whitespace-pre-line">{c.notes}</p>{/if}
	</Section>

	<Section title="Adjustment visits" IconComp={CalendarCheck} style="identityIcon">
		{#snippet editDialog()}
			{#if data.canWrite && (c.status === 'active' || c.status === 'retention')}
				<Button size="sm" class="ml-auto" onclick={() => (visitOpen = true)}>
					<Plus class="size-4" /> Record a visit
				</Button>
			{/if}
		{/snippet}
		{#if data.visits.length}
			<ul class="flex flex-col divide-y text-sm">
				{#each data.visits as v (v.id)}
					<li class="flex flex-wrap items-baseline gap-x-3 py-2">
						<span class="w-32 shrink-0 text-muted-foreground">{day(v.visitedOn)}</span>
						<span class="flex-1">{v.work}</span>
						{#if v.nextInWeeks}
							<span class="text-muted-foreground">
								Back {day(addClinicDays(v.visitedOn, v.nextInWeeks * 7))}
							</span>
						{/if}
						{#if v.provider}<span class="text-muted-foreground">· {v.provider}</span>{/if}
						{#if v.note}<p class="w-full text-muted-foreground">{v.note}</p>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">No adjustment visit recorded yet.</p>
		{/if}
	</Section>

	<Section title="Payment plan" IconComp={Receipt} style="identityIcon">
		<DataTable
			{columns}
			data={c.instalments}
			facetKeys={['state']}
			fileName="ortho-plan"
			height="auto"
		/>
	</Section>
</div>

<FormDialog
	title="Record an adjustment visit"
	action="?/visit"
	data={data.forms.visit}
	schema={newVisit}
	bind:open={visitOpen}
	hideTrigger
	resetOnSuccess
	submitLabel="Record"
>
	{#snippet fields({ form, errors })}
		<div class="grid grid-cols-2 gap-3">
			<InputComp label="Day" name="visitedOn" type="date" oldDays {form} {errors} />
			<InputComp
				label="Back in (weeks)"
				name="nextInWeeks"
				required={false}
				placeholder="4"
				{form}
				{errors}
			/>
		</div>
		<InputComp
			label="What was done"
			name="work"
			placeholder="Upper 0.016 NiTi, lower 0.018 SS, class II elastics"
			{form}
			{errors}
		/>
		<InputComp
			label="Orthodontist"
			name="providerId"
			type="select"
			items={data.providers}
			required={false}
			{form}
			{errors}
		/>
		<InputComp
			label="Booked visit"
			name="appointmentId"
			type="select"
			items={data.visitOptions}
			required={false}
			{form}
			{errors}
		/>
		<InputComp label="Note" name="note" type="textarea" rows={2} required={false} {form} {errors} />
	{/snippet}
</FormDialog>
