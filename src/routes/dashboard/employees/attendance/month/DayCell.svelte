<script lang="ts">
	import type { DayKind } from '$lib/attendance';
	import DayBadge from '../DayBadge.svelte';

	/**
	 * One person's day on the month grid: its letter, the times on hover, and a link to that day's
	 * register, where it is corrected.
	 */
	let {
		day,
		cell
	}: {
		day: string;
		cell: {
			kind: DayKind;
			late: number;
			clockIn: string | null;
			clockOut: string | null;
			note: string | null;
		};
	} = $props();

	const title = $derived(
		cell.kind === 'present'
			? `${cell.clockIn}–${cell.clockOut ?? 'still in'}${cell.late ? ` · ${cell.late} min late` : ''}`
			: (cell.note ?? '')
	);
</script>

<a href="/dashboard/employees/attendance?day={day}" {title} class="inline-flex">
	<DayBadge kind={cell.kind} short />
	{#if cell.late}<span class="sr-only">late</span>{/if}
</a>
