<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import MessageSquare from '@lucide/svelte/icons/message-square';
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
	import { useI18n } from '$lib/i18n/i18n.svelte';

	/**
	 * The reminder call list: one day's appointments still to come, with who has been rung. Ring,
	 * then press **Reminded** — ticking that they will come confirms the visit in the same step.
	 */
	let { data } = $props();
	const t = useI18n();
	const r = $derived(t.m.appointments.reminders);

	/* Texting the whole day: one press, then the list reloads with who was texted. */
	let textingAll = $state(false);
	const sendingAll: SubmitFunction = () => {
		textingAll = true;
		return async ({ update }) => {
			await update({ reset: false });
			textingAll = false;
		};
	};

	let open = $state(false);
	let seed = $state<Partial<LogReminder>>({});
	let calling = $state('');

	const columns = $derived(
		reminderColumns(
			t.m,
			data.canRemind
				? (row) => {
						calling = `${row.patient} · ${clinicClock(row.startsAt)}`;
						seed = { appointmentId: row.id, confirmed: row.status === 'confirmed' };
						open = true;
					}
				: null,
			data.canRemind && data.canText
		)
	);

	const left = $derived(data.rows.filter((r) => r.reminderSentAt === null).length);
	const confirmed = $derived(data.rows.filter((r) => r.status === 'confirmed').length);

	/** A share as a whole percent, or nothing to show yet. */
	const percent = (rate: number | null) => (rate === null ? 0 : Math.round(rate * 100));

	const TILES = $derived<Stat[]>([
		{
			key: 'appointments',
			label: r.tileAppointments,
			value: data.rows.length,
			format: 'count',
			group: 'reminders'
		},
		{
			key: 'left',
			label: r.tileLeft,
			value: left,
			format: 'count',
			group: 'reminders',
			tone: left ? 'warning' : 'neutral'
		},
		{
			key: 'confirmed',
			label: r.tileConfirmed,
			value: confirmed,
			format: 'count',
			group: 'reminders'
		},
		{
			key: 'effect',
			label: r.tileEffect,
			value: percent(data.effect.reminded.rate),
			format: 'percent',
			group: 'reminders',
			hint:
				data.effect.reminded.rate === null || data.effect.notReminded.rate === null
					? r.notEnough(data.effectWindow)
					: r.against(
							percent(data.effect.notReminded.rate),
							data.effect.reminded.visits,
							data.effect.notReminded.visits,
							data.effectWindow
						)
		}
	]);

	const dayLabel = $derived(
		data.day === data.today
			? t.m.common.today
			: data.day === data.tomorrow
				? t.m.common.tomorrow
				: null
	);
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

	<Section
		title="{dayLabel ? `${dayLabel} · ` : ''}{formatEthiopianDate(
			new Date(`${data.day}T12:00:00Z`)
		)}"
		IconComp={Phone}
		style="identityIcon"
	>
		{#snippet editDialog()}
			{#if data.canRemind && data.canText && data.rows.some((row) => row.sms.state === 'ready' && row.reminderSentAt === null)}
				<form method="post" action="?/textAll" use:enhance={sendingAll}>
					<input type="hidden" name="date" value={data.day} />
					<Button type="submit" size="sm" disabled={textingAll}>
						<MessageSquare class="size-4" />
						{t.m.common.sms.textAll}
					</Button>
				</form>
			{/if}
			<div class="ml-auto flex flex-wrap gap-1" role="group" aria-label={r.whichDay}>
				<Button
					size="sm"
					variant="outline"
					href="?date={data.previousDay}"
					aria-label={t.m.common.dayBefore}
				>
					<ChevronLeft class="size-4" />
				</Button>
				<Button
					size="sm"
					variant={data.day === data.today ? 'default' : 'outline'}
					href="?date={data.today}">{t.m.common.today}</Button
				>
				<Button
					size="sm"
					variant={data.day === data.tomorrow ? 'default' : 'outline'}
					href="?date={data.tomorrow}">{t.m.common.tomorrow}</Button
				>
				<Button
					size="sm"
					variant="outline"
					href="?date={data.nextDay}"
					aria-label={t.m.common.dayAfter}
				>
					<ChevronRight class="size-4" />
				</Button>
			</div>
		{/snippet}
		{#if data.rows.length}
			<DataTable
				{columns}
				data={data.rows}
				facetKeys={['reminded', 'status', 'provider']}
				facetLabels={{
					reminded: r.reminded,
					status: t.m.common.status,
					provider: t.m.common.dentist
				}}
				search
				fileName="reminders-{data.day}"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">
				{r.empty}
			</p>
		{/if}
	</Section>
</div>

<FormDialog
	title={r.dialogTitle(calling)}
	description={r.dialogDescription}
	action="?/logReminder"
	data={data.form}
	schema={logReminder}
	bind:open
	{seed}
	hideTrigger
	submitLabel={r.recordIt}
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="appointmentId" value={values.appointmentId} />
		<InputComp
			{form}
			{errors}
			name="confirmed"
			type="checkboxSingle"
			label={r.confirmed}
			placeholder={r.confirmedHint}
		/>
	{/snippet}
</FormDialog>
