<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import PackageOpen from '@lucide/svelte/icons/package-open';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import PatientPicker from '$lib/components/PatientPicker.svelte';
	import { CYCLE_KINDS, CYCLE_KIND_LABEL } from '$lib/sterilisation';
	import { cycleColumns } from './columns';
	import { newCycle, usePacksForm } from './schema';

	/**
	 * The sterilisation log: each cycle with its indicators and how many of its packs are used, and
	 * the two things done every day — recording a cycle as it comes out, and recording packs opened
	 * for a patient. A failed cycle is red in the Result column; its page lists who to call.
	 */
	let { data } = $props();

	const LOAD_HINT = 'One kind a line, the number first:\n6 exam kit\n2 extraction set';

	let recordOpen = $state(false);
	let useOpen = $state(false);

	const kinds = CYCLE_KINDS.map((k) => ({ value: k, name: CYCLE_KIND_LABEL[k] }));
	const strip = [
		{ value: 'pass', name: 'Changed colour — pass' },
		{ value: 'fail', name: 'Did not change — fail' },
		{ value: 'none', name: 'No strip in this load' }
	];
	const spores = [
		{ value: 'none', name: 'No spore test in this load' },
		{ value: 'pending', name: 'Spore test in — read it later' }
	];
</script>

<svelte:head>
	<title>Sterilisation</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<Section title="Sterilisation log" IconComp={ShieldCheck} style="identityIcon">
		{#snippet editDialog()}
			<div class="ml-auto flex flex-wrap gap-2">
				<Button size="sm" variant="outline" onclick={() => (useOpen = true)}>
					<PackageOpen class="size-4" /> Packs used on a patient
				</Button>
				<Button size="sm" disabled={!data.sterilisers.length} onclick={() => (recordOpen = true)}>
					<Plus class="size-4" /> Record a cycle
				</Button>
			</div>
		{/snippet}

		{#if !data.sterilisers.length}
			<p class="mb-3 text-sm text-muted-foreground">
				{data.oneBranch
					? 'No steriliser is set up at this branch.'
					: 'Choose a branch in the top bar to record its cycles.'} Sterilisers are added under
				<strong>Clinic Setup → Sterilisers</strong>.
			</p>
		{/if}

		{#if data.cycles.length}
			<DataTable
				columns={cycleColumns}
				data={data.cycles}
				facetKeys={['status', 'kind']}
				fileName="sterilisation-log"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">No cycle is recorded yet.</p>
		{/if}
	</Section>
</div>

<FormDialog
	title="Record a cycle"
	description="As it comes out of the machine. Packs are labelled from the load; a load whose strip failed is resterilised, not labelled."
	action="?/record"
	data={data.forms.record}
	schema={newCycle}
	bind:open={recordOpen}
	hideTrigger
	submitLabel="Record"
>
	{#snippet fields({ form, errors, values })}
		<InputComp
			label="Steriliser"
			name="steriliserId"
			type="select"
			items={data.sterilisers}
			{form}
			{errors}
		/>
		<InputComp label="What it was" name="kind" type="select" items={kinds} {form} {errors} />
		<div class="grid grid-cols-2 gap-3">
			<InputComp label="Day" name="ranOn" type="date" oldDays {form} {errors} />
			<InputComp label="Time" name="ranAt" placeholder="09:30" {form} {errors} />
		</div>
		<div class="grid grid-cols-3 gap-3">
			<InputComp
				label="Program"
				name="program"
				required={false}
				placeholder="134 °C · 4 min"
				{form}
				{errors}
			/>
			<InputComp
				label="°C"
				name="temperatureC"
				required={false}
				placeholder="134"
				{form}
				{errors}
			/>
			<InputComp
				label="Minutes held"
				name="holdMinutes"
				required={false}
				placeholder="4"
				{form}
				{errors}
			/>
		</div>
		<InputComp
			label="Indicator strip"
			name="chemical"
			type="select"
			items={strip}
			{form}
			{errors}
		/>
		<InputComp label="Spore test" name="biological" type="select" items={spores} {form} {errors} />
		{#if values.kind === 'load' && values.chemical !== 'fail'}
			<InputComp
				label="Packs in the load"
				name="load"
				type="textarea"
				rows={3}
				required={false}
				placeholder={LOAD_HINT}
				{form}
				{errors}
			/>
			<InputComp label="Sterile for (days)" name="shelfDays" type="number" {form} {errors} />
		{/if}
		<InputComp label="Note" name="note" type="textarea" rows={2} required={false} {form} {errors} />
	{/snippet}
</FormDialog>

<FormDialog
	title="Packs used on a patient"
	description="Type or scan the code on each pack opened. A pack is used once; one from a failed cycle or past its date is refused."
	action="?/use"
	data={data.forms.use}
	schema={usePacksForm}
	bind:open={useOpen}
	hideTrigger
	resetOnSuccess
	submitLabel="Record"
>
	{#snippet fields({ form, errors })}
		<PatientPicker {form} />
		<InputComp
			label="Pack codes"
			name="codes"
			type="textarea"
			rows={3}
			placeholder="2-0118-03"
			{form}
			{errors}
		/>
	{/snippet}
</FormDialog>
