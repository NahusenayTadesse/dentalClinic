<script lang="ts">
	import Phone from '@lucide/svelte/icons/phone';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import type { Stat } from '@nahu/admin-kit/components/reports/types.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { clinicClock } from '$lib/clinicTime';
	import { reminderColumns } from './columns';
	import { logReminder, type LogReminder } from './schema';

	/**
	 * The reminder call list: one day's appointments still to come, with who has been rung. Ring,
	 * then press **Reminded** — ticking that they will come confirms the visit in the same step.
	 */
	let { data } = $props();

	let open = $state(false);
	let seed = $state<Partial<LogReminder>>({});
	let calling = $state('');

	const columns = $derived(
		reminderColumns(
			data.canRemind
				? (row) => {
						calling = `${row.patient} · ${clinicClock(row.startsAt)}`;
						seed = { appointmentId: row.id, confirmed: row.status === 'confirmed' };
						open = true;
					}
				: null
		)
	);

	const left = $derived(data.rows.filter((r) => r.reminderSentAt === null).length);
	const confirmed = $derived(data.rows.filter((r) => r.status === 'confirmed').length);

	/** A share as a whole percent, or nothing to show yet. */
	const percent = (rate: number | null) => (rate === null ? 0 : Math.round(rate * 100));

	const TILES = $derived<Stat[]>([
		{
			key: 'appointments',
			label: 'Appointments',
			value: data.rows.length,
			format: 'count',
			group: 'reminders'
		},
		{
			key: 'left',
			label: 'Left to remind',
			value: left,
			format: 'count',
			group: 'reminders',
			tone: left ? 'warning' : 'neutral'
		},
		{
			key: 'confirmed',
			label: 'Confirmed',
			value: confirmed,
			format: 'count',
			group: 'reminders'
		},
		{
			key: 'effect',
			label: 'No-shows when reminded',
			value: percent(data.effect.reminded.rate),
			format: 'percent',
			group: 'reminders',
			hint:
				data.effect.reminded.rate === null || data.effect.notReminded.rate === null
					? `Not enough visits in the last ${data.effectWindow} days to compare`
					: `Against ${percent(data.effect.notReminded.rate)}% when not reminded · ${data.effect.reminded.visits} and ${data.effect.notReminded.visits} visits, last ${data.effectWindow} days`
		}
	]);

	const dayLabel = $derived(
		data.day === data.today ? 'Today' : data.day === data.tomorrow ? 'Tomorrow' : null
	);
</script>

<svelte:head>
	<title>Reminders</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">Reminders</h1>
		<p class="text-muted-foreground">
			Appointments at this branch still to come on one day. Ring each patient and record it here, so
			nobody is rung twice and the clinic can see whether reminding cuts no-shows.
		</p>
	</header>

	<section class="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Reminders at a glance">
		{#each TILES as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</section>

	<Section
		title="{dayLabel ? `${dayLabel} · ` : ''}{formatEthiopianDate(
			new Date(`${data.day}T12:00:00Z`)
		)}"
		IconComp={Phone}
		style="identityIcon"
	>
		{#snippet editDialog()}
			<div class="ml-auto flex flex-wrap gap-1" role="group" aria-label="Which day">
				<Button size="sm" variant="outline" href="?date={data.previousDay}" aria-label="Day before">
					<ChevronLeft class="size-4" />
				</Button>
				<Button
					size="sm"
					variant={data.day === data.today ? 'default' : 'outline'}
					href="?date={data.today}">Today</Button
				>
				<Button
					size="sm"
					variant={data.day === data.tomorrow ? 'default' : 'outline'}
					href="?date={data.tomorrow}">Tomorrow</Button
				>
				<Button size="sm" variant="outline" href="?date={data.nextDay}" aria-label="Day after">
					<ChevronRight class="size-4" />
				</Button>
			</div>
		{/snippet}
		{#if data.rows.length}
			<DataTable
				{columns}
				data={data.rows}
				facetKeys={['reminded', 'status', 'provider']}
				search
				fileName="reminders-{data.day}"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">
				No appointments still to come at this branch on this day.
			</p>
		{/if}
	</Section>
</div>

<FormDialog
	title="Reminded {calling}"
	description="Record that the patient has been reminded of this appointment."
	action="?/logReminder"
	data={data.form}
	schema={logReminder}
	bind:open
	{seed}
	hideTrigger
	submitLabel="Record it"
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="appointmentId" value={values.appointmentId} />
		<InputComp
			{form}
			{errors}
			name="confirmed"
			type="checkboxSingle"
			label="Confirmed"
			placeholder="They said they will come"
		/>
	{/snippet}
</FormDialog>
