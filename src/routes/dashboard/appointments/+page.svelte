<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import List from '@lucide/svelte/icons/list';
	import CalendarOff from '@lucide/svelte/icons/calendar-off';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { clinicClock } from '$lib/clinicTime';
	import { STATUS_LABEL, APPOINTMENT_STATUSES } from '$lib/appointmentStatus';
	import DayGrid from './day-grid.svelte';
	import BookDialog from './book-dialog.svelte';
	import AppointmentDialog from './appointment-dialog.svelte';
	import type { DayAppointment } from './types';

	let { data } = $props();

	const isToday = $derived(data.day === data.today);

	/* ── Booking ─────────────────────────────────────────────────────────── */
	// svelte-ignore state_referenced_locally
	let bookOpen = $state(Boolean(data.bookPatient));
	let prefill = $state<{ date?: string; time?: string; operatoryId?: number; walkIn?: boolean }>(
		{}
	);

	function book(options: typeof prefill = {}) {
		prefill = { date: data.day, ...options };
		bookOpen = true;
	}

	/* ── One appointment ────────────────────────────────────────────────── */
	/*
	 * Which appointment is open. `?open=` sets it once per new value, not on every load: after a
	 * save the load re-runs with the same URL, and re-reading it would reopen the dialog the save
	 * had just closed.
	 */
	let openId = $state<number | null>(null);
	let lastUrlOpen: number | null = null;
	$effect(() => {
		const fromUrl = data.openId;
		if (fromUrl === lastUrlOpen) return;
		lastUrlOpen = fromUrl;
		if (fromUrl) openId = fromUrl;
	});
	const opened = $derived(data.appointments.find((a) => a.id === openId) ?? null);

	/* ── The day at a glance ────────────────────────────────────────────── */
	const counts = $derived(
		APPOINTMENT_STATUSES.map((status) => ({
			status,
			count: data.appointments.filter((a) => a.status === status).length
		})).filter((c) => c.count > 0)
	);

	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(timer);
	});
	const minutesSince = (value: Date | string | null) =>
		value ? Math.max(0, Math.round((now - new Date(value).getTime()) / 60_000)) : 0;

	const waiting = $derived(data.appointments.filter((a) => a.status === 'arrived'));
	const inChair = $derived(data.appointments.filter((a) => a.status === 'inChair'));
	const shortNotice = $derived(
		data.appointments.filter(
			(a) => a.isAsap && (a.status === 'scheduled' || a.status === 'confirmed')
		)
	);

	const open = (a: DayAppointment) => (openId = a.id);
</script>

<svelte:head>
	<title>Appointments</title>
</svelte:head>

<div class="flex flex-col gap-4 py-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1>Appointments</h1>
			<p class="text-sm text-muted-foreground">
				{formatEthiopianDate(new Date(`${data.day}T12:00:00Z`))} · {data.day}{isToday
					? ' · Today'
					: ''}
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<Button
				variant="outline"
				size="icon"
				href="?date={data.previousDay}"
				aria-label="Previous day"
			>
				<ChevronLeft class="size-4" />
			</Button>
			<Button variant="outline" href="?date={data.today}" disabled={isToday}>Today</Button>
			<Button variant="outline" size="icon" href="?date={data.nextDay}" aria-label="Next day">
				<ChevronRight class="size-4" />
			</Button>
			<!-- A GET form rather than goto(): picking a date is navigation, and SvelteKit already does
			     it client-side for a form, with the date in the URL where the load reads it. -->
			<form method="get" class="contents">
				<Input
					type="date"
					name="date"
					class="w-40"
					value={data.day}
					aria-label="Go to date"
					onchange={(e) => e.currentTarget.value && e.currentTarget.form?.requestSubmit()}
				/>
			</form>
			<Button variant="outline" href="/dashboard/appointments/list"
				><List class="size-4" /> List</Button
			>
			{#if data.canBook && !data.needsBranch}
				<Button variant="outline" onclick={() => book({ walkIn: true })}>
					<DoorOpen class="size-4" /> Walk-in
				</Button>
				<Button onclick={() => book()}><CalendarPlus class="size-4" /> Book</Button>
			{/if}
		</div>
	</div>

	{#if data.needsBranch}
		<!-- A grid of every branch would put two clinics' Chair 1 under one heading (§15). -->
		<div class="rounded-lg border bg-card p-6">
			<p class="font-medium">Choose a branch in the top bar to see its day.</p>
			<p class="text-sm text-muted-foreground">
				The day view is drawn by chair, and chairs belong to a branch. The
				<a class="underline" href="/dashboard/appointments/list">appointment list</a> shows every branch.
			</p>
		</div>
	{:else}
		{#if data.closure}
			<p
				class="flex items-center gap-2 rounded-md border border-amber-500 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
			>
				<CalendarOff class="size-4" />
				The clinic is closed today: {data.closure.name}. New bookings on this day are refused.
			</p>
		{/if}

		<div class="flex flex-wrap items-center gap-2 text-sm">
			<span class="font-medium">{data.appointments.length} appointments</span>
			{#each counts as c (c.status)}
				<span class="rounded-md border px-2 py-0.5 text-muted-foreground">
					{STATUS_LABEL[c.status].label}
					{c.count}
				</span>
			{/each}
		</div>

		<div class="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_18rem]">
			{#if data.chairs.length}
				<DayGrid
					chairs={data.chairs}
					appointments={data.appointments}
					{isToday}
					canBook={data.canBook}
					onSlot={(chairId, time) => book({ time, operatoryId: chairId ?? undefined })}
					onOpen={open}
				/>
			{:else}
				<div class="rounded-lg border bg-card p-6">
					<p class="font-medium">This branch has no chairs yet.</p>
					<p class="text-sm text-muted-foreground">
						The day view has a column per chair. Add them under
						<a class="underline" href="/dashboard/admin-panel/chairs">Admin Panel → Chairs</a>.
					</p>
				</div>
			{/if}

			<!-- Who is here: the front desk's actual question once the day has started. -->
			<aside class="flex flex-col gap-4">
				<section class="rounded-lg border bg-card p-4">
					<h3 class="mb-2 text-sm font-semibold">Waiting ({waiting.length})</h3>
					{#each waiting as a (a.id)}
						<button
							type="button"
							class="flex w-full justify-between py-1 text-left text-sm hover:underline"
							onclick={() => open(a)}
						>
							<span class="truncate">{a.patient}</span>
							<span
								class={minutesSince(a.arrivedAt) > 30
									? 'text-destructive'
									: 'text-muted-foreground'}
							>
								{minutesSince(a.arrivedAt)} min
							</span>
						</button>
					{:else}
						<p class="text-sm text-muted-foreground">Nobody waiting.</p>
					{/each}
				</section>

				<section class="rounded-lg border bg-card p-4">
					<h3 class="mb-2 text-sm font-semibold">In the chair ({inChair.length})</h3>
					{#each inChair as a (a.id)}
						<button
							type="button"
							class="flex w-full justify-between py-1 text-left text-sm hover:underline"
							onclick={() => open(a)}
						>
							<span class="truncate">{a.patient}</span>
							<span class="text-muted-foreground"
								>{a.chair ?? '—'} · {minutesSince(a.seatedAt)} min</span
							>
						</button>
					{:else}
						<p class="text-sm text-muted-foreground">No one in a chair.</p>
					{/each}
				</section>

				{#if shortNotice.length}
					<section class="rounded-lg border bg-card p-4">
						<h3 class="mb-2 text-sm font-semibold">Could come earlier</h3>
						{#each shortNotice as a (a.id)}
							<button
								type="button"
								class="flex w-full justify-between py-1 text-left text-sm hover:underline"
								onclick={() => open(a)}
							>
								<span class="truncate">{a.patient}</span>
								<span class="text-muted-foreground">{clinicClock(a.startsAt)}</span>
							</button>
						{/each}
					</section>
				{/if}
			</aside>
		</div>
	{/if}
</div>

{#if data.canBook && !data.needsBranch}
	<BookDialog
		bind:open={bookOpen}
		data={data.forms.book}
		{prefill}
		patient={data.bookPatient}
		providers={data.providers}
		types={data.types}
		chairs={data.chairs}
	/>
{/if}

{#if opened}
	{#key opened.id}
		<AppointmentDialog
			bind:open={
				() => opened !== null,
				(value) => {
					if (!value) openId = null;
				}
			}
			appointment={opened}
			forms={data.forms}
			providers={data.providers}
			chairs={data.chairs}
			canBook={data.canBook}
			canChart={data.canChart}
		/>
	{/key}
{/if}
