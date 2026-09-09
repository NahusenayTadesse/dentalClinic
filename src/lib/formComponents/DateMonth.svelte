<script lang="ts">
	import RangeCalendar from '$lib/components/ui/range-calendar/range-calendar.svelte';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import { CalendarIcon, SlidersHorizontal } from '@lucide/svelte';
	import type { DateRange } from 'bits-ui';
	import * as Popover from '$lib/components/ui/popover/index.js';

	import { cn } from '$lib/utils.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { isMobile } from '$lib/global.svelte';
	import { goto } from '$app/navigation';

	let {
		id = null,
		link = '/dashboard/staff',
		start = '2025-11-08',
		end = '2025-11-08'
	}: { id?: number; link: string; start?: string; end?: string } = $props();

	let startDate = new Date(start);
	let endDate = new Date(end);

	let value = $state<DateRange>({
		start: new CalendarDate(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate()),
		end: new CalendarDate(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate())
	});

	let open = $state(false);
	let contentRef = $state<HTMLElement | null>(null);

	function formatDate(input: DateValue | string | null | undefined) {
		if (!input || String(input).includes('Pick')) return 'Pick a date';

		// CalendarDate → JS Date
		const d =
			input instanceof CalendarDate
				? new Date(input.year, input.month - 1, input.day)
				: new Date(input.toString());

		return isNaN(d.getTime()) // make sure we really have a valid date
			? 'Pick a date'
			: d.toLocaleDateString('am-ET', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					calendar: 'ethiopic'
				});
	}

	let number = isMobile;
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class={cn(
			buttonVariants({
				variant: 'outline',
				class: 'w-70 justify-start text-start font-normal'
			}),
			!value && 'text-muted-foreground'
		)}
	>
		<CalendarIcon />
		{value
			? formatDate(value.start ?? 'Pick a start date') +
				' - ' +
				formatDate(value.end ?? 'Pick an end date')
			: 'Pick a date'}
	</Popover.Trigger>
	<Popover.Content bind:ref={contentRef} class="w-full p-0">
		<div class="ti flex flex-row justify-between text-sm text-muted-foreground">
			<p>
				Ethiopian Date: <span class="font-semibold text-foreground"
					>{formatDate(value.start ?? 'Pick a start date') +
						' - ' +
						formatDate(value.end ?? 'Pick an end date')}</span
				>
			</p>
			<Button
				disabled={!value.start || !value.end}
				onclick={() => {
					open = false;

					goto(
						id === null
							? `${link}/${value.start}-${value.end}`
							: `${link}/ranges/${value.start}-${value.end}-${id}`
					);
				}}
			>
				<SlidersHorizontal /> Filter
			</Button>
		</div>

		<RangeCalendar
			bind:value
			class="relative w-auto rounded-lg border pb-16 shadow-sm"
			numberOfMonths={isMobile() ? 1 : 2}
		/>
		<Button
			disabled={!value.start || !value.end}
			class="absolute right-2 bottom-2"
			onclick={() => {
				open = false;

				goto(
					id === null
						? `${link}/${value.start}-${value.end}`
						: `${link}/ranges/${value.start}-${value.end}-${id}`
				);
			}}
		>
			<SlidersHorizontal /> Filter
		</Button>
	</Popover.Content>
</Popover.Root>
