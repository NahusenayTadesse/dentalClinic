<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Plus from '@lucide/svelte/icons/plus';
	import Smile from '@lucide/svelte/icons/smile';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatETB } from '$lib/global.svelte';
	import { APPLIANCES, APPLIANCE_LABEL, instalmentSchedule, planProblem } from '$lib/orthoPlan';
	import CaseSummary from './CaseSummary.svelte';
	import { newCase } from './schema';

	/**
	 * The orthodontic tab: each course of treatment as a card — what is worn, how far along, where
	 * the payments stand — and starting one. The dialog shows the payment plan as it is typed, worked
	 * out by the rule the server saves it by.
	 */
	let { data } = $props();

	let openDialog = $state(false);
	const appliances = APPLIANCES.map((a) => ({ value: a, name: APPLIANCE_LABEL[a] }));
	const base = $derived(`/dashboard/patients/${data.patient.id}/ortho`);

	/** The plan the dialog's numbers make, or why they make none. */
	function preview(v: {
		totalFee?: unknown;
		deposit?: unknown;
		instalments?: unknown;
		startedOn?: unknown;
	}) {
		const input = {
			totalFee: Number(v.totalFee) || 0,
			deposit: Number(v.deposit) || 0,
			count: Number(v.instalments) || 0
		};
		const problem = planProblem(input);
		if (problem) return problem;
		const plan = instalmentSchedule({ ...input, startedOn: String(v.startedOn || '2000-01-01') });
		const monthly = plan.find((p) => p.n === 1);
		return monthly
			? `${input.deposit ? `${formatETB(input.deposit)} on the day, then ` : ''}${input.count} × ${formatETB(monthly.amount)} a month.`
			: `${formatETB(input.deposit)} on the day; nothing after.`;
	}
</script>

<svelte:head>
	<title>{data.patient.fullName} — Orthodontics</title>
</svelte:head>

<Section title="Orthodontics" IconComp={Smile} style="identityIcon">
	{#snippet editDialog()}
		{#if data.canWrite}
			<Button size="sm" class="ml-auto" onclick={() => (openDialog = true)}>
				<Plus class="size-4" /> Start a case
			</Button>
		{/if}
	{/snippet}

	{#if data.cases.length}
		<ul class="flex flex-col gap-3">
			{#each data.cases as c (c.id)}
				<li>
					<a
						href="{base}/{c.id}"
						class="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/40"
					>
						<div class="min-w-0 flex-1"><CaseSummary {c} /></div>
						<ChevronRight class="size-5 shrink-0 text-muted-foreground" />
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-muted-foreground">
			No orthodontic treatment. A case holds the appliance, the adjustment visits, and the payment
			plan — a deposit and monthly instalments, each billed as it falls due.
		</p>
	{/if}
</Section>

<FormDialog
	title="Start an orthodontic case"
	description="The fee and its payment plan are fixed once instalments are billed."
	action="?/open"
	data={data.forms.open}
	schema={newCase}
	bind:open={openDialog}
	hideTrigger
	submitLabel="Start"
>
	{#snippet fields({ form, errors, values })}
		<InputComp
			label="Appliance"
			name="appliance"
			type="select"
			items={appliances}
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
		<div class="grid grid-cols-2 gap-3">
			<InputComp label="Treatment starts" name="startedOn" type="date" oldDays {form} {errors} />
			<InputComp label="Planned months" name="plannedMonths" type="number" {form} {errors} />
		</div>
		<div class="grid grid-cols-3 gap-3">
			<InputComp label="Whole fee (Br)" name="totalFee" type="number" {form} {errors} />
			<InputComp
				label="Deposit (Br)"
				name="deposit"
				type="number"
				required={false}
				{form}
				{errors}
			/>
			<InputComp label="Monthly instalments" name="instalments" type="number" {form} {errors} />
		</div>
		<p class="rounded-md bg-muted p-2 text-sm">{preview(values)}</p>
		<InputComp
			label="Diagnosis and plan"
			name="notes"
			type="textarea"
			rows={2}
			required={false}
			placeholder="Class II div 1, crowding; non-extraction"
			{form}
			{errors}
		/>
	{/snippet}
</FormDialog>
