<script lang="ts">
	import Activity from '@lucide/svelte/icons/activity';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { perioColumns } from './columns';
	import { newExam } from './schema';
	import PerioSummaryLine from './PerioSummaryLine.svelte';

	/**
	 * The periodontal chart tab: the latest exam's figures, every exam with its trend, and starting a
	 * new one. An open draft is offered for finishing rather than a second one started — the server
	 * refuses two (`server/perio.ts`).
	 */
	let { data } = $props();

	let startOpen = $state(false);
	const columns = $derived(perioColumns(data.patient.id));
	const latest = $derived(data.exams[0]);
	const draft = $derived(data.exams.find((e) => !e.completedAt));
</script>

<svelte:head>
	<title>{data.patient.fullName} — Periodontal chart</title>
</svelte:head>

<Section title="Periodontal chart" IconComp={Activity} style="identityIcon">
	{#snippet editDialog()}
		{#if data.canWrite}
			{#if draft}
				<Button
					size="sm"
					class="ml-auto"
					href="/dashboard/patients/{data.patient.id}/perio/{draft.id}"
				>
					Carry on charting
				</Button>
			{:else}
				<Button size="sm" class="ml-auto" onclick={() => (startOpen = true)}>
					<Plus class="size-4" /> Chart the gums
				</Button>
			{/if}
		{/if}
	{/snippet}

	{#if latest}
		<div class="mb-4 flex flex-col gap-2">
			<p class="text-sm text-muted-foreground">
				Latest: {formatEthiopianDate(new Date(latest.examinedOn))}{latest.completedAt
					? ''
					: ' (still being charted)'}
			</p>
			<PerioSummaryLine
				summary={latest.summary}
				changes={latest.changes}
				comparedWith={latest.comparedWith
					? formatEthiopianDate(new Date(latest.comparedWith))
					: null}
			/>
		</div>
		<DataTable {columns} data={data.exams} fileName="periodontal-exams" height="auto" />
	{:else}
		<p class="text-sm text-muted-foreground">
			The gums have not been charted. Pocket depths, bleeding and mobility charted here are compared
			at every later exam.
		</p>
	{/if}
</Section>

<FormDialog
	title="Chart the gums"
	description="All 32 adult teeth, six sites each. Teeth the dental chart shows as gone start marked missing."
	action="?/start"
	data={data.forms.start}
	schema={newExam}
	bind:open={startOpen}
	hideTrigger
	submitLabel="Start"
>
	{#snippet fields({ form, errors })}
		<InputComp
			label="Who is probing"
			name="providerId"
			type="select"
			items={data.providers}
			required={false}
			{form}
			{errors}
		/>
		<InputComp
			label="At which visit"
			name="appointmentId"
			type="select"
			items={data.visits}
			required={false}
			{form}
			{errors}
		/>
	{/snippet}
</FormDialog>
