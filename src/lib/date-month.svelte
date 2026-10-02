<script lang="ts">
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import {
		Popover,
		PopoverContent,
		PopoverTrigger
	} from '@nahu/admin-kit/components/ui/popover/index.js';
	import { Calendar } from '$lib/components/ui/calendar';
	import { CalendarIcon } from '@lucide/svelte';
	import { getLocalTimeZone, type CalendarDate } from '@internationalized/date';
	import { formatEthiopianDate } from './global.svelte';

	interface Props {
		start?: CalendarDate | null;
		end?: CalendarDate | null;
		link?: string;
		onDateChange?: (dates: { start: CalendarDate; end: CalendarDate }) => void;
	}

	let { start = null, end = null, link = '', onDateChange }: Props = $props();

	let startDate: CalendarDate | undefined = $derived(start ?? undefined);
	let endDate: CalendarDate | undefined = $derived(end ?? undefined);

	const handleStartChange = (value: CalendarDate | undefined) => {
		if (!value) return;
		startDate = value;
		if (endDate) onDateChange?.({ start: startDate, end: endDate });
	};

	const handleEndChange = (value: CalendarDate | undefined) => {
		if (!value) return;
		endDate = value;
		if (startDate) onDateChange?.({ start: startDate, end: endDate });
	};
</script>

<div class="flex items-center gap-2">
	<Popover>
		<PopoverTrigger>
			{#snippet child({ props })}
				<Button variant="outline" class="min-w-35 justify-start text-left font-normal" {...props}>
					<CalendarIcon class="mr-2 size-4 text-muted-foreground" />
					{startDate
						? formatEthiopianDate(new Date(startDate.toDate(getLocalTimeZone()).toISOString()))
						: 'Start date'}
				</Button>
			{/snippet}
		</PopoverTrigger>
		<PopoverContent class="w-auto p-0" align="start">
			<Calendar locale="am-ET" type="single" value={startDate} onValueChange={handleStartChange} />
		</PopoverContent>
	</Popover>

	<span class="text-sm text-muted-foreground">to</span>

	<Popover>
		<PopoverTrigger>
			{#snippet child({ props })}
				<Button variant="outline" class="min-w-35 justify-start text-left font-normal" {...props}>
					<CalendarIcon class="mr-2 size-4 text-muted-foreground" />
					{endDate
						? formatEthiopianDate(new Date(endDate.toDate(getLocalTimeZone()).toISOString()))
						: 'End date'}
				</Button>
			{/snippet}
		</PopoverTrigger>
		<PopoverContent class="w-auto p-0" align="start">
			<Calendar type="single" value={endDate} onValueChange={handleEndChange} />
		</PopoverContent>
	</Popover>
</div>
