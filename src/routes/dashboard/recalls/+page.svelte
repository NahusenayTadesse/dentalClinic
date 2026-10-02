<script lang="ts">
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import FormDialog from '$lib/formComponents/FormDialog.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { recallColumns } from './columns';
	import { logCall, type LogCall } from './schema';

	/**
	 * The recall list: who is due back, the longest overdue first. Ring them, log how it went, and
	 * book — a booking takes them off the list by itself.
	 */
	let { data } = $props();

	let callOpen = $state(false);
	let callSeed = $state<Partial<LogCall>>({});
	let calling = $state('');

	const columns = $derived(
		recallColumns((row) => {
			calling = row.patient;
			callSeed = { recallId: row.id, outcome: 'noAnswer', note: row.note ?? '' };
			callOpen = true;
		}, data.maxAttempts)
	);

	const WINDOW_LABEL: Record<number, string> = {
		0: 'Overdue only',
		14: 'Next 2 weeks',
		30: 'Next 30 days',
		60: 'Next 60 days'
	};
	const OUTCOMES = [
		{ value: 'noAnswer', name: 'No answer — try again' },
		{ value: 'callBack', name: 'Spoke — they will call back or asked to be rung later' },
		{ value: 'declined', name: 'Declined — do not ring again for this' },
		{ value: 'stopped', name: 'Stop — moved away, treated elsewhere, or died' }
	];
</script>

<svelte:head>
	<title>Recalls</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">Recalls</h1>
		<p class="text-muted-foreground">
			Patients due back at this branch who have not booked. A check-up completed in the diary adds
			the next one here by itself.
		</p>
	</header>

	<section class="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Recalls at a glance">
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Due in this window</p>
			<p class="text-2xl font-bold tabular-nums">{data.summary.dueNow}</p>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Overdue</p>
			<p class="text-2xl font-bold tabular-nums {data.summary.overdue ? 'text-destructive' : ''}">
				{data.summary.overdue}
			</p>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Booked</p>
			<p class="text-2xl font-bold tabular-nums">{data.summary.booked}</p>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Came back when asked</p>
			<p class="text-2xl font-bold tabular-nums">
				{data.summary.cameBack === null ? '—' : `${data.summary.cameBack}%`}
			</p>
		</div>
	</section>

	<Section title="Due back" IconComp={BellRing} style="identityIcon">
		{#snippet editDialog()}
			<div class="ml-auto flex flex-wrap gap-1" role="group" aria-label="How far ahead">
				{#each data.windows as within (within)}
					<Button
						size="sm"
						variant={data.within === within ? 'default' : 'outline'}
						href="?within={within}">{WINDOW_LABEL[within]}</Button
					>
				{/each}
			</div>
		{/snippet}
		{#if data.recalls.length}
			<DataTable
				{columns}
				data={data.recalls}
				facetKeys={['visit', 'calls']}
				search
				fileName="recalls"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">Nobody at this branch is due back in this window.</p>
		{/if}
	</Section>
</div>

<FormDialog
	title="Log a call to {calling}"
	action="?/logCall"
	data={data.form}
	schema={logCall}
	bind:open={callOpen}
	seed={callSeed}
	hideTrigger
	submitLabel="Log it"
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="recallId" value={values.recallId} />
		<InputComp label="How it went" name="outcome" type="select" {form} {errors} items={OUTCOMES} />
		<InputComp
			label="Note"
			name="note"
			{form}
			{errors}
			required={false}
			placeholder="Ring after 5pm · wants a Saturday"
		/>
	{/snippet}
</FormDialog>
