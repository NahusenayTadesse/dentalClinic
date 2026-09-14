<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { clinicClock, clinicMinutes } from '$lib/clinicTime';
	import { STATUS_LABEL, isAppointmentStatus, isLive } from '$lib/appointmentStatus';
	import type { DayAppointment } from './types';

	/**
	 * One day as a grid: time down the side, a column per chair, each appointment a block sized by
	 * its duration.
	 *
	 * Positions are minutes since clinic-local midnight (`clinicMinutes`), never `getHours()`, so the
	 * grid is right whatever timezone the browser is in. Sizes are inline styles because they are
	 * computed from data — the one use of `style=""` CLAUDE.md §7 allows.
	 *
	 * Colour follows `appointment_type.colour`, then the dentist's, as the schema says; it is drawn
	 * as a stripe on a plain card rather than a filled block, so the text stays readable whatever
	 * colour a clinic picks. Cancelled and no-show appointments stay visible but faded and narrow —
	 * the slot is free again, and the history of it is still there.
	 *
	 * Appointments with no chair get a column of their own at the end, so booking the clinic rather
	 * than a chair (see `appointment.operatoryId`) never hides anybody.
	 */
	let {
		chairs,
		appointments,
		isToday,
		canBook,
		onSlot,
		onOpen
	}: {
		chairs: { id: number; name: string }[];
		appointments: DayAppointment[];
		isToday: boolean;
		canBook: boolean;
		onSlot: (chairId: number | null, time: string) => void;
		onOpen: (appointment: DayAppointment) => void;
	} = $props();

	/** Pixels per minute: a 30-minute slot is 48px, tall enough for two lines. */
	const SCALE = 1.6;
	const SLOT = 15;

	/* The working day, widened to take in anything booked outside it. */
	const first = $derived(
		Math.min(7 * 60, ...appointments.map((a) => Math.floor(clinicMinutes(a.startsAt) / 60) * 60))
	);
	const last = $derived(
		Math.max(
			19 * 60,
			...appointments.map(
				(a) => Math.ceil((clinicMinutes(a.startsAt) + a.durationMinutes) / 60) * 60
			)
		)
	);
	const hours = $derived(Array.from({ length: (last - first) / 60 }, (_, i) => first + i * 60));

	const columns = $derived([
		...chairs.map((c) => ({ id: c.id as number | null, name: c.name })),
		...(appointments.some(
			(a) => a.operatoryId === null || !chairs.some((c) => c.id === a.operatoryId)
		)
			? [{ id: null, name: 'No chair' }]
			: [])
	]);

	const inColumn = (id: number | null) =>
		appointments.filter((a) =>
			id === null
				? a.operatoryId === null || !chairs.some((c) => c.id === a.operatoryId)
				: a.operatoryId === id
		);

	let now = $state(Date.now());
	$effect(() => {
		if (!isToday) return;
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});
	const nowTop = $derived((clinicMinutes(new Date(now)) - first) * SCALE);

	function clickSlot(event: MouseEvent, chairId: number | null) {
		if (!canBook) return;
		const target = event.currentTarget as HTMLElement;
		const offset = event.clientY - target.getBoundingClientRect().top;
		const minutes = first + Math.floor(offset / SCALE / SLOT) * SLOT;
		const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
		const mm = String(minutes % 60).padStart(2, '0');
		onSlot(chairId, `${hh}:${mm}`);
	}

	const colourOf = (a: DayAppointment) => a.typeColour ?? a.providerColour ?? 'var(--primary)';

	const statusClass: Record<string, string> = {
		scheduled: '',
		confirmed: '',
		arrived: 'ring-2 ring-amber-500',
		inChair: 'ring-2 ring-primary',
		completed: 'opacity-70',
		noShow: 'opacity-50 line-through',
		cancelled: 'opacity-50 line-through'
	};
</script>

<div class="overflow-x-auto rounded-lg border bg-card">
	<div
		class="grid min-w-full"
		style="grid-template-columns: 4rem repeat({columns.length}, minmax(11rem, 1fr));"
	>
		<!-- Header row -->
		<div class="sticky top-0 z-20 border-b bg-card"></div>
		{#each columns as column (column.id ?? 'none')}
			<div class="sticky top-0 z-20 border-b border-l bg-card px-2 py-2 text-sm font-medium">
				{column.name}
			</div>
		{/each}

		<!-- Time gutter -->
		<div class="relative" style="height: {(last - first) * SCALE}px">
			{#each hours as hour (hour)}
				<div
					class="absolute right-2 text-xs text-muted-foreground {hour === first
						? ''
						: '-translate-y-2'}"
					style="top: {(hour - first) * SCALE}px"
				>
					{String(hour / 60).padStart(2, '0')}:00
				</div>
			{/each}
		</div>

		{#each columns as column (column.id ?? 'none')}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="relative border-l {canBook ? 'cursor-copy' : ''}"
				style="height: {(last - first) * SCALE}px"
				onclick={(e) => clickSlot(e, column.id)}
				title={canBook ? 'Click an empty time to book' : undefined}
			>
				{#each hours as hour (hour)}
					<div class="absolute inset-x-0 border-t" style="top: {(hour - first) * SCALE}px"></div>
					<div
						class="absolute inset-x-0 border-t border-dashed opacity-50"
						style="top: {(hour - first + 30) * SCALE}px"
					></div>
				{/each}

				{#if isToday && nowTop > 0 && nowTop < (last - first) * SCALE}
					<div
						class="absolute inset-x-0 z-10 border-t-2 border-destructive"
						style="top: {nowTop}px"
					></div>
				{/if}

				{#each inColumn(column.id) as a (a.id)}
					{@const live = isAppointmentStatus(a.status) && isLive(a.status)}
					<button
						type="button"
						class="absolute z-10 flex flex-col items-start overflow-hidden rounded-md border bg-background px-2 py-1 text-left text-xs shadow-xs hover:bg-accent {statusClass[
							a.status
						]}"
						style="top: {(clinicMinutes(a.startsAt) - first) * SCALE}px; height: {Math.max(
							a.durationMinutes * SCALE,
							22
						)}px; border-left: 4px solid {colourOf(a)}; {live
							? 'left: 4px; right: 4px;'
							: 'right: 4px; width: 35%;'}"
						onclick={(e) => {
							e.stopPropagation();
							onOpen(a);
						}}
					>
						<span class="flex w-full items-center gap-1 font-medium">
							{#if a.severeAllergies.length || a.medicineAlerts.length}
								<TriangleAlert class="size-3 shrink-0 text-destructive" />
							{/if}
							<span class="truncate">{a.patient}</span>
						</span>
						<span class="truncate text-muted-foreground">
							{clinicClock(a.startsAt)} · {a.type ?? 'Appointment'}{a.provider
								? ` · ${a.provider}`
								: ''}
						</span>
						{#if a.status !== 'scheduled'}
							<span class="truncate text-muted-foreground">
								{isAppointmentStatus(a.status) ? STATUS_LABEL[a.status].label : a.status}
							</span>
						{/if}
					</button>
				{/each}
			</div>
		{/each}
	</div>
</div>
