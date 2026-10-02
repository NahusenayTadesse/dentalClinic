<script lang="ts">
	import CalendarRange from '@lucide/svelte/icons/calendar-range';
	import X from '@lucide/svelte/icons/x';
	import { getLocalTimeZone, parseDate, today, type DateValue } from '@internationalized/date';
	import type { DateRange } from 'bits-ui';

	import RangeCalendar from '@nahu/admin-kit/components/ui/range-calendar/range-calendar.svelte';
	import * as Popover from '@nahu/admin-kit/components/ui/popover/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { setServerParams } from './table-state.svelte';

	/**
	 * A date window for a server-mode table, written to `dateStart`/`dateEnd`.
	 *
	 * Those two params were already understood by every load — `parseTableQuery` reads them and
	 * `buildWhere` applies them to the spec's `dateColumn` — but since the filter bar left the
	 * list pages, nothing on screen could set them. This is that control, in the table's own
	 * toolbar, so a list does not grow a second bar to get one back.
	 *
	 * Both ends or neither: `buildWhere` ignores a half-open window, so this never writes one.
	 * Presets first, because "registered this month" is the question almost every time and a
	 * two-month calendar is a lot of clicking to ask it.
	 *
	 * Non-goal: client mode. A table holding every row can filter them itself, and a date column
	 * there is better served by a facet.
	 */
	let {
		label,
		start,
		end
	}: {
		/** What the window applies to — "Registered", "Issued". */
		label: string;
		/** The current `dateStart`/`dateEnd`, as `YYYY-MM-DD`. */
		start?: string | null;
		end?: string | null;
	} = $props();

	let open = $state(false);

	const tz = getLocalTimeZone();

	/** The window as the URL holds it, or empty when the URL holds none (or holds rubbish). */
	function fromUrl(): DateRange {
		try {
			return start && end
				? { start: parseDate(start), end: parseDate(end) }
				: { start: undefined, end: undefined };
		} catch {
			return { start: undefined, end: undefined };
		}
	}

	// Follows the URL — a back button, a cleared filter — and is overwritten while picking.
	let range = $derived<DateRange>(fromUrl());

	/** Dates shown the way every other date in the app is: on the Ethiopian calendar. */
	const ethiopian = new Intl.DateTimeFormat('am-ET', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		calendar: 'ethiopic'
	});

	const summary = $derived(
		start && end
			? `${ethiopian.format(parseDate(start).toDate(tz))} – ${ethiopian.format(parseDate(end).toDate(tz))}`
			: null
	);

	function apply(from: DateValue, to: DateValue) {
		open = false;
		setServerParams({ dateStart: from.toString(), dateEnd: to.toString() });
	}

	function clear() {
		open = false;
		setServerParams({ dateStart: null, dateEnd: null });
	}

	const presets = [
		{ label: 'Today', days: 0 },
		{ label: 'Last 7 days', days: 6 },
		{ label: 'Last 30 days', days: 29 },
		{ label: 'Last 90 days', days: 89 },
		{ label: 'Last 12 months', days: 364 }
	];
</script>

<div class="flex items-center">
	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant={summary ? 'default' : 'outline'} class="gap-2">
					<CalendarRange class="size-4" />
					{label}{summary ? `: ${summary}` : ''}
				</Button>
			{/snippet}
		</Popover.Trigger>

		<Popover.Content class="flex w-auto flex-col gap-3 p-3" align="start">
			<div class="flex flex-wrap gap-2">
				{#each presets as preset (preset.label)}
					<Button
						variant="outline"
						size="sm"
						onclick={() => apply(today(tz).subtract({ days: preset.days }), today(tz))}
					>
						{preset.label}
					</Button>
				{/each}
			</div>

			<RangeCalendar bind:value={range} class="rounded-md border" captionLayout="dropdown" />

			<div class="flex justify-end gap-2">
				{#if summary}
					<Button variant="ghost" size="sm" onclick={clear}>Clear</Button>
				{/if}
				<Button
					size="sm"
					disabled={!range.start || !range.end}
					onclick={() => range.start && range.end && apply(range.start, range.end)}
				>
					Apply
				</Button>
			</div>
		</Popover.Content>
	</Popover.Root>

	{#if summary}
		<Button variant="ghost" size="icon" aria-label="Clear {label} dates" onclick={clear}>
			<X class="size-4" />
		</Button>
	{/if}
</div>
