<script lang="ts">
	import CalendarRange from '@lucide/svelte/icons/calendar-range';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import UsersRound from '@lucide/svelte/icons/users-round';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import FormDialog from '$lib/formComponents/FormDialog.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import StepButton from '$lib/formComponents/StepButton.svelte';
	import { addClinicDays } from '$lib/clinicTime';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { registerAct, type RegisterActForm } from '$lib/forms/attendance';
	import RegisterRow from './RegisterRow.svelte';

	/**
	 * The day's attendance register, kept by tapping: **In** when someone arrives, **Out** when they
	 * leave, **Excused** for an absence with a reason. Anyone scheduled with nothing recorded by the
	 * end of the day is absent, and payroll deducts it — so the list puts who has not come first.
	 */
	let { data } = $props();

	let search = $state('');
	let show = $state<'all' | 'waiting' | 'in'>('all');

	let timesOpen = $state(false);
	let excuseOpen = $state(false);
	let seed = $state<Partial<RegisterActForm>>({});
	let who = $state('');

	type Person = (typeof data.people)[number];

	/** Who has not come yet first; within that, by department and name as the load ordered them. */
	const order = (p: Person) => (p.kind === 'notYet' || p.kind === 'absent' ? 0 : p.open ? 1 : 2);

	const shown = $derived(
		data.people
			.filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
			.filter((p) =>
				show === 'waiting'
					? p.kind === 'notYet' || p.kind === 'absent'
					: show === 'in'
						? p.open
						: true
			)
			.toSorted((a, b) => order(a) - order(b))
	);

	const groups = $derived(
		Object.entries(Object.groupBy(shown, (p) => p.department ?? 'No department'))
	);

	function editTimes(p: Person) {
		who = p.name;
		seed = {
			staffId: p.id,
			day: data.day,
			act: 'times',
			clockIn: p.record?.clockIn ?? '',
			clockOut: p.record?.clockOut ?? ''
		};
		timesOpen = true;
	}

	function excuse(p: Person) {
		who = p.name;
		seed = { staffId: p.id, day: data.day, act: 'excuse', note: '' };
		excuseOpen = true;
	}

	const TILES = $derived([
		{ label: 'Scheduled', value: data.totals.scheduled },
		{ label: 'In', value: data.totals.present },
		{ label: data.isToday ? 'Not in yet' : 'Absent', value: data.totals.waiting, warn: true },
		{ label: 'Still in', value: data.totals.stillIn },
		{ label: 'Late', value: data.totals.late },
		{ label: 'Excused or on leave', value: data.totals.excused + data.totals.leave }
	]);
</script>

<svelte:head>
	<title>Attendance — {formatEthiopianDate(new Date(data.day))}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<header class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-extrabold tracking-tight">Attendance</h1>
			<p class="text-muted-foreground">
				{formatEthiopianDate(new Date(data.day))} · {new Date(
					`${data.day}T00:00:00Z`
				).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}{data.isToday
					? ' · today'
					: ''}
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<Button
				variant="outline"
				size="icon"
				href="?day={addClinicDays(data.day, -1)}"
				aria-label="Previous day"
			>
				<ChevronLeft class="size-4" />
			</Button>
			<Button variant="outline" href="?day={data.today}" disabled={data.isToday}>Today</Button>
			<Button
				variant="outline"
				size="icon"
				href="?day={addClinicDays(data.day, 1)}"
				disabled={data.isToday}
				aria-label="Next day"
			>
				<ChevronRight class="size-4" />
			</Button>
			<Button variant="outline" href="/dashboard/employees/attendance/month">
				<CalendarRange class="size-4" /> Month
			</Button>
		</div>
	</header>

	<section class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="The day">
		{#each TILES as tile (tile.label)}
			<div class="rounded-lg border bg-card p-3">
				<p class="text-sm text-muted-foreground">{tile.label}</p>
				<p
					class="text-2xl font-bold tabular-nums {tile.warn && tile.value && !data.isToday
						? 'text-destructive'
						: ''}"
				>
					{tile.value}
				</p>
			</div>
		{/each}
	</section>

	<div class="flex flex-wrap items-center gap-2">
		{#if data.markable}
			<StepButton
				id="mark-all-in"
				action="?/markAllIn"
				data={data.forms.all}
				label="Everyone scheduled is in ({data.markable})"
				icon={UsersRound}
				variant="default"
				values={{ day: data.day }}
				confirm={{
					title: `Mark ${data.markable} in at their scheduled start?`,
					description:
						'For a morning when everybody came. Anyone already recorded is left alone; correct anyone who was late afterwards.',
					action: 'Mark them in'
				}}
			/>
		{/if}
		<Input
			class="max-w-xs"
			type="search"
			placeholder="Find someone…"
			bind:value={search}
			aria-label="Find someone"
		/>
		<div class="flex gap-1" role="group" aria-label="Show">
			{#each [['all', 'Everyone'], ['waiting', data.isToday ? 'Not in yet' : 'Absent'], ['in', 'Still in']] as const as [value, label] (value)}
				<Button
					size="sm"
					variant={show === value ? 'default' : 'outline'}
					onclick={() => (show = value)}>{label}</Button
				>
			{/each}
		</div>
	</div>

	{#if !data.people.length}
		<p class="rounded-lg border p-6 text-center text-muted-foreground">
			Nobody at this branch is on the register. Staff appear here once they are active and approved,
			with a working schedule on their profile.
		</p>
	{:else}
		{#each groups as [department, people] (department)}
			<section class="rounded-lg border bg-card px-4">
				<h2 class="border-b py-2 text-sm font-semibold text-muted-foreground">
					{department} · {people?.length ?? 0}
				</h2>
				<ul class="divide-y">
					{#each people ?? [] as person (person.id)}
						<RegisterRow
							{person}
							day={data.day}
							form={data.forms.act}
							onedit={() => editTimes(person)}
							onexcuse={() => excuse(person)}
						/>
					{/each}
				</ul>
			</section>
		{:else}
			<p class="text-sm text-muted-foreground">Nobody matches.</p>
		{/each}
	{/if}
</div>

<FormDialog
	title="Times for {who}"
	description="Clinic time. Leave Out empty while they are still in."
	action="?/record"
	data={data.forms.times}
	schema={registerAct}
	bind:open={timesOpen}
	{seed}
	hideTrigger
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="staffId" value={values.staffId} />
		<input type="hidden" name="day" value={values.day} />
		<input type="hidden" name="act" value="times" />
		<InputComp label="In" name="clockIn" type="time" {form} {errors} />
		<InputComp label="Out" name="clockOut" type="time" required={false} {form} {errors} />
	{/snippet}
</FormDialog>

<FormDialog
	title="Excuse {who}’s absence"
	description="The day is not deducted. Say why — a sick note, an errand for the clinic."
	action="?/record"
	data={data.forms.excuse}
	schema={registerAct}
	bind:open={excuseOpen}
	{seed}
	hideTrigger
	submitLabel="Excuse"
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="staffId" value={values.staffId} />
		<input type="hidden" name="day" value={values.day} />
		<input type="hidden" name="act" value="excuse" />
		<InputComp label="Why" name="note" placeholder="Sick note · Clinic errand" {form} {errors} />
	{/snippet}
</FormDialog>
