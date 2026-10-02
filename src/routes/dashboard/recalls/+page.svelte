<script lang="ts">
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import type { Stat } from '@nahu/admin-kit/components/reports/types.js';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { recallColumns } from './columns';
	import { logCall, type LogCall } from './schema';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	/**
	 * The recall list: who is due back, the longest overdue first. Ring them, log how it went, and
	 * book — a booking takes them off the list by itself.
	 */
	let { data } = $props();
	const t = useI18n();
	const r = $derived(t.m.appointments.recalls);

	let callOpen = $state(false);
	let callSeed = $state<Partial<LogCall>>({});
	let calling = $state('');

	const columns = $derived(
		recallColumns(
			t.m,
			(row) => {
				calling = row.patient;
				callSeed = { recallId: row.id, outcome: 'noAnswer', note: row.note ?? '' };
				callOpen = true;
			},
			data.maxAttempts
		)
	);

	const OUTCOMES = $derived([
		{ value: 'noAnswer', name: r.outcomeNoAnswer },
		{ value: 'callBack', name: r.outcomeCallBack },
		{ value: 'declined', name: r.outcomeDeclined },
		{ value: 'stopped', name: r.outcomeStopped }
	]);

	const TILES = $derived<Stat[]>([
		{
			key: 'due',
			label: r.tileDue,
			value: data.summary.dueNow,
			format: 'count',
			group: 'recall'
		},
		{
			key: 'overdue',
			label: r.tileOverdue,
			value: data.summary.overdue,
			format: 'count',
			group: 'recall',
			tone: data.summary.overdue ? 'warning' : 'neutral'
		},
		{
			key: 'booked',
			label: r.tileBooked,
			value: data.summary.booked,
			format: 'count',
			group: 'recall'
		},
		{
			key: 'cameBack',
			label: r.tileCameBack,
			value: data.summary.cameBack ?? 0,
			format: 'percent',
			group: 'recall',
			hint: data.summary.cameBack === null ? r.notLongEnough : undefined
		}
	]);
</script>

<svelte:head>
	<title>{r.title}</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">{r.title}</h1>
		<p class="text-muted-foreground">
			{r.intro}
		</p>
	</header>

	<section class="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label={r.title}>
		{#each TILES as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</section>

	<Section title={r.dueBack} IconComp={BellRing} style="identityIcon">
		{#snippet editDialog()}
			<div class="ml-auto flex flex-wrap gap-1" role="group" aria-label={r.howFarAhead}>
				{#each data.windows as within (within)}
					<Button
						size="sm"
						variant={data.within === within ? 'default' : 'outline'}
						href="?within={within}">{r.window(within)}</Button
					>
				{/each}
			</div>
		{/snippet}
		{#if data.recalls.length}
			<DataTable
				{columns}
				data={data.recalls}
				facetKeys={['visit', 'calls']}
				facetLabels={{ visit: t.m.common.what, calls: r.calls }}
				search
				fileName="recalls"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">{r.empty}</p>
		{/if}
	</Section>
</div>

<FormDialog
	title={r.logCallTitle(calling)}
	action="?/logCall"
	data={data.form}
	schema={logCall}
	bind:open={callOpen}
	seed={callSeed}
	hideTrigger
	submitLabel={r.logIt}
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="recallId" value={values.recallId} />
		<InputComp label={r.howItWent} name="outcome" type="select" {form} {errors} items={OUTCOMES} />
		<InputComp
			label={t.m.common.note}
			name="note"
			{form}
			{errors}
			required={false}
			placeholder={r.notePlaceholder}
		/>
	{/snippet}
</FormDialog>
