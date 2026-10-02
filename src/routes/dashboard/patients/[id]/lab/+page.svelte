<script lang="ts">
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { labCaseColumns } from '$lib/components/labCases/columns';
	import { newLabCase } from '$lib/forms/labCase';

	/**
	 * The patient's Lab work tab: what has gone out to a laboratory for them, where it is now, and
	 * sending something new. Moving a case on is the same buttons as the lab board.
	 */
	let { data } = $props();

	let sendOpen = $state(false);
	const columns = $derived(
		labCaseColumns({ withPatient: false, move: data.canManage ? data.forms.move : null })
	);
</script>

<svelte:head>
	<title>{data.patient.fullName} — Lab work</title>
</svelte:head>

<Section title="Lab work" IconComp={FlaskConical} style="identityIcon">
	{#snippet editDialog()}
		{#if data.canManage}
			<Button
				size="sm"
				class="ml-auto"
				disabled={!data.labs.length}
				onclick={() => (sendOpen = true)}
			>
				<Plus class="size-4" /> Send to a lab
			</Button>
		{/if}
	{/snippet}

	{#if data.canManage && !data.labs.length}
		<p class="mb-3 text-sm text-muted-foreground">
			No laboratory is set up. Add one under <strong>Clinic Setup → Dental Labs</strong> first.
		</p>
	{/if}

	{#if data.cases.length}
		<DataTable
			{columns}
			data={data.cases}
			facetKeys={['status', 'lab']}
			fileName="lab-work"
			height="auto"
		/>
	{:else}
		<p class="text-sm text-muted-foreground">Nothing has been sent to a lab for this patient.</p>
	{/if}
</Section>

<FormDialog
	title="Send work to a lab"
	description="Choose the charted work it is for, and its tooth comes with it. Otherwise say what is being made and for which teeth."
	action="?/add"
	data={data.forms.add}
	schema={newLabCase}
	bind:open={sendOpen}
	hideTrigger
	resetOnSuccess
	submitLabel="Save"
>
	{#snippet fields({ form, errors, values })}
		<InputComp label="Laboratory" name="labId" type="select" items={data.labs} {form} {errors} />
		<InputComp
			label="For which charted work"
			name="procedureId"
			type="select"
			items={data.work}
			required={false}
			{form}
			{errors}
		/>
		{#if !values.procedureId}
			<InputComp
				label="What is being made"
				name="serviceId"
				type="select"
				items={data.services}
				required={false}
				{form}
				{errors}
			/>
			<InputComp
				label="Teeth"
				name="teeth"
				placeholder="21, or a span like 14-16"
				required={false}
				{form}
				{errors}
			/>
		{/if}
		<InputComp
			label="Dentist"
			name="providerId"
			type="select"
			items={data.providers}
			required={false}
			{form}
			{errors}
		/>
		<InputComp label="Shade" name="shade" placeholder="A2" required={false} {form} {errors} />
		<InputComp
			label="Lab fee (birr)"
			name="labFee"
			type="number"
			min={0}
			required={false}
			{form}
			{errors}
		/>
		<InputComp
			label="Instructions on the docket"
			name="instructions"
			type="textarea"
			required={false}
			{form}
			{errors}
		/>
		<InputComp label="Sent today" name="send" type="checkboxSingle" {form} {errors} />
		{#if values.send}
			<InputComp
				label="Due back"
				name="dueOn"
				type="date"
				oldDays={false}
				allowEmpty
				required={false}
				{form}
				{errors}
				description="Leave it empty to use the laboratory’s usual turnaround."
			/>
		{/if}
	{/snippet}
</FormDialog>
