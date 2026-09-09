<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { getEthiopianYearInt } from '$lib/global.svelte';
	import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/svelte';

	let { value = $bindable<string[]>([]) } = $props();

	let isOpen = $state(false);

	const months = [
		'መስከረም',
		'ጥቅምት',
		'ህዳር',
		'ታህሳስ',
		'ጥር',
		'የካቲት',
		'መጋቢት',
		'ሚያዝያ',
		'ግንቦት',
		'ሰኔ',
		'ሐምሌ',
		'ነሐሴ'
	];

	let selectedYear = $state(getEthiopianYearInt(new Date()));

	// Keys are "month_year" strings, same format as before
	const isSelected = (month: string) => value.includes(`${month}_${selectedYear}`);

	const toggleMonth = (month: string) => {
		const key = `${month}_${selectedYear}`;
		if (value.includes(key)) {
			value = value.filter((v) => v !== key);
		} else {
			value = [...value, key];
		}
	};

	const clearAll = () => (value = []);

	const formatted = $derived(
		value.length === 0
			? 'Select months'
			: value.length === 1
				? value[0].replace('_', ' ')
				: `${value.length} months selected`
	);

	const previousYear = () => (selectedYear -= 1);
	const nextYear = () => (selectedYear += 1);
</script>

<Popover bind:open={isOpen}>
	<PopoverTrigger class="w-full">
		<Button variant="outline" class="w-full justify-start text-left font-normal">
			{formatted}
		</Button>
	</PopoverTrigger>

	<PopoverContent class="w-72 p-0" align="start">
		<div class="flex flex-col gap-4 p-4">
			<!-- month grid -->
			<div>
				<h3 class="mb-3 text-center text-sm font-semibold">{selectedYear}</h3>
				<div class="grid grid-cols-3 gap-2">
					{#each months as month}
						<Button
							variant={isSelected(month) ? 'default' : 'outline'}
							size="sm"
							class="h-8"
							onclick={() => toggleMonth(month)}
						>
							{month}
						</Button>
					{/each}
				</div>
			</div>

			<!-- year changer + clear -->
			<div class="flex items-center justify-between border-t pt-2">
				<Button variant="ghost" size="sm" onclick={previousYear}>
					<ChevronLeftIcon class="size-4" />
				</Button>
				<span class="text-sm font-medium">{selectedYear}</span>
				<Button variant="ghost" size="sm" onclick={nextYear}>
					<ChevronRightIcon class="size-4" />
				</Button>
			</div>

			{#if value.length > 0}
				<Button variant="ghost" size="sm" class="w-full text-muted-foreground" onclick={clearAll}>
					Clear all ({value.length})
				</Button>
			{/if}
		</div>
	</PopoverContent>
</Popover>
