<script lang="ts">
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '$lib/components/Section.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import FormDialog from '$lib/formComponents/FormDialog.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import ProcedurePicker from '$lib/components/ProcedurePicker.svelte';
	import { planColumns } from './columns';
	import { newPlan } from './schema';

	/**
	 * The treatment plans tab: what this patient has been offered, and a new plan from the work
	 * planned on their chart. Opening a plan is where it is presented, answered and printed.
	 */
	let { data } = $props();

	let newOpen = $state(false);
	const columns = $derived(planColumns(data.patient.id));
</script>

<svelte:head>
	<title>{data.patient.fullName} — Treatment plans</title>
</svelte:head>

<Section title="Treatment plans" IconComp={ClipboardList} style="identityIcon">
	{#snippet editDialog()}
		{#if data.canPlan}
			<Button size="sm" class="ml-auto" onclick={() => (newOpen = true)}>
				<Plus class="size-4" /> New plan
			</Button>
		{/if}
	{/snippet}

	{#if data.plans.length}
		<DataTable
			{columns}
			data={data.plans}
			facetKeys={['status']}
			fileName="treatment-plans"
			height="auto"
		/>
	{:else}
		<p class="text-sm text-muted-foreground">
			No plan has been drawn up for this patient. A plan quotes the work charted as
			<em>planned</em> on the dental chart, so that is where it starts.
		</p>
	{/if}
</Section>

<FormDialog
	title="New treatment plan"
	description="Choose the planned work to quote. It starts as a draft: you can change wording and prices before presenting it."
	action="?/newPlan"
	data={data.form}
	schema={newPlan}
	bind:open={newOpen}
	hideTrigger
	submitLabel="Start the plan"
	disabled={!data.canPlan}
>
	{#snippet fields({ form, errors })}
		<ProcedurePicker {form} work={data.plannable} legend="Planned work to quote">
			{#snippet empty()}
				No planned work is free to quote. Chart the treatment as <em>planned</em> on the dental chart
				first; work already on an open plan is not listed.
			{/snippet}
		</ProcedurePicker>
		<InputComp
			label="Proposed by"
			name="providerId"
			type="select"
			{form}
			{errors}
			items={data.providers}
			required={false}
		/>
		<InputComp
			label="Note"
			name="note"
			type="textarea"
			rows={2}
			{form}
			{errors}
			required={false}
			placeholder="Anything the patient asked about, or should know"
		/>
	{/snippet}
</FormDialog>
