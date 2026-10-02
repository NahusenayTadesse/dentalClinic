<script lang="ts">
	import { Button, buttonVariants } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Calendar } from '@nahu/admin-kit/components/ui/calendar/index.js';
	import * as Popover from '@nahu/admin-kit/components/ui/popover/index.js';
	import { cn } from '$lib/utils.js';
	import { CalendarDate, getLocalTimeZone, today, parseDate } from '@internationalized/date';
	import { untrack } from 'svelte';
	import { CalendarIcon } from '@lucide/svelte';

	let {
		data = $bindable(),
		oldDays = false,
		year = false,
		futureDays = false,
		allowEmpty = false
	}: {
		data: string;
		oldDays?: boolean;
		year?: boolean;
		futureDays?: boolean;
		/**
		 * Let the field stay empty, and offer a way back to empty.
		 *
		 * Off by default, because most dates here are required and starting on today saves a click.
		 * On an *optional* date that default is a lie the form tells silently: a licence expiry left
		 * alone was saved as today, and the providers list then said the licence expired in zero
		 * days. A date nobody entered has to stay blank.
		 */
		allowEmpty?: boolean;
	} = $props();

	const todayDate = $derived(oldDays ? undefined : today(getLocalTimeZone()));

	/** A `YYYY-MM-DD` as a calendar date, or null when it is empty or not a date. */
	function parsed(value: string | undefined): CalendarDate | null {
		if (!value) return null;
		try {
			return parseDate(value);
		} catch {
			return null;
		}
	}

	/*
	 * `data` is the only copy of the date; the calendar reads it and writes it back.
	 *
	 * This used to keep its own `$state` copy, seeded from `data` once and pushed back into `data`
	 * by an effect. A value written from outside after mounting was then overwritten with the
	 * picker's stale copy, depending on which effect flushed first: the appointment booking dialog
	 * prefilled the day being viewed, and every booking silently landed on today.
	 */
	const value = $derived(parsed(data) ?? todayDate ?? today(getLocalTimeZone()));

	// An empty field still starts at today, as it always has — but only when it is empty, so it
	// can never replace a date somebody set, and never when the field may be left blank.
	$effect(() => {
		if (!data && !allowEmpty) untrack(() => (data = value.toString()));
	});

	/** Empty and allowed to be: the trigger says so rather than showing a date nobody chose. */
	const isEmpty = $derived(allowEmpty && !data);

	const formatEthiopianDate = (date: CalendarDate | undefined): string => {
		if (!date) return '';

		const formatter = new Intl.DateTimeFormat('am-ET', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			calendar: 'ethiopic'
		});

		return formatter.format(date.toDate(getLocalTimeZone()));
	};
	const displayDate = $derived(isEmpty ? 'Not set' : formatEthiopianDate(value));
</script>

<Popover.Root>
	<Popover.Trigger
		class={cn(
			buttonVariants({
				variant: 'outline',
				class: 'justify-between '
			})
		)}
	>
		<div class="flex items-center gap-2">
			<CalendarIcon />
			{displayDate}
		</div>
	</Popover.Trigger>

	<Popover.Content class="flex flex-wrap gap-2 border-t p-0 px-2 py-4!">
		<div class="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
			<span>Ethiopian Date: <span class="font-semibold text-foreground">{displayDate}</span></span>
			{#if allowEmpty && data}
				<Button variant="ghost" size="sm" onclick={() => (data = '')}>Clear</Button>
			{/if}
		</div>

		<Calendar
			locale="am-ET"
			type="single"
			captionLayout={year ? 'dropdown-years' : 'label'}
			minValue={todayDate}
			maxValue={futureDays ? today(getLocalTimeZone()) : undefined}
			bind:value={() => value, (next) => next && (data = next.toString())}
		/>
		{#each [{ label: 'Today', value: 0 }, { label: 'Tomorrow', value: 1 }, { label: 'In 3 days', value: 3 }, { label: 'In a week', value: 7 }, { label: 'In 2 weeks', value: 14 }] as preset (preset.value)}
			<Button
				variant="outline"
				size="sm"
				class="flex-1"
				onclick={() => {
					data = today(getLocalTimeZone()).add({ days: preset.value }).toString();
				}}
			>
				{preset.label}
			</Button>
		{/each}
	</Popover.Content>
</Popover.Root>
