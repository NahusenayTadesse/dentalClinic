<script lang="ts">
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import {
		Popover,
		PopoverContent,
		PopoverTrigger
	} from '@nahu/admin-kit/components/ui/popover/index.js';
	import { getEthiopianYearInt } from '$lib/global.svelte';
	import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/svelte';

	let { value = $bindable('') } = $props();

	let isOpen = $state(false);

	/* ---------- derived state ---------- */
	const months = [
		'መስከረም', // 1
		'ጥቅምት', // 2
		'ህዳር', // 3
		'ታህሳስ', // 4
		'ጥር', // 5
		'የካቲት', // 6
		'መጋቢት', // 7
		'ሚያዝያ', // 8
		'ግንቦት', // 9
		'ሰኔ', // 10
		'ሐምሌ', // 11
		'ነሐሴ' // 12
	];

	function getEthiopianMonthAmharic(num: number): string {
		const months = [
			'መስከረም', // 1
			'ጥቅምት', // 2
			'ህዳር', // 3
			'ታህሳስ', // 4
			'ጥር', // 5
			'የካቲት', // 6
			'መጋቢት', // 7
			'ሚያዝያ', // 8
			'ግንቦት', // 9
			'ሰኔ', // 10
			'ሐምሌ', // 11
			'ነሐሴ' // 12
		];

		return num >= 1 && num <= 13 ? months[num - 1] : 'የተሳሳተ ቁጥር';
	}
	const monthsShort = months.map((m) => m.slice(0, 3));

	// let selectedYear = $derived(
	// 	value
	// 		? getEthiopianYearInt(new Date(parseInt(value.split('_')[1])))
	// 		: getEthiopianYearInt(new Date())
	// );
	// let selectedMonth = $derived(value ? value.split('_')[0] : '');
	//
	//
	let selectedYear = $state(getEthiopianYearInt(new Date()));

	// 2. Update your derived logic for selectedMonth
	let selectedMonth = $derived(value ? value.split('_')[0] : '');

	let displayValue = $derived(value || 'Select month and year');

	export const getEthiopianMonth = (month: number | string): string => {
		let monthNumber: number | undefined;

		if (typeof month === 'number') {
			monthNumber = month;
		} else {
			monthNumber = MONTH_MAP[month.toLowerCase()];
		}

		if (!monthNumber || monthNumber < 1 || monthNumber > 12) {
			return '';
		}

		// Fixed reference year to avoid edge cases
		const date = new Date(2024, monthNumber - 1, 1);

		const formatter = new Intl.DateTimeFormat('am-ET', {
			month: 'long',
			calendar: 'ethiopic'
		});

		return formatter.format(date);
	};

	/* ---------- actions ---------- */
	const selectMonth = (month: string) => {
		value = `${month}_${selectedYear}`;
		isOpen = false;
	};

	const MONTH_MAP: Record<string, number> = {
		january: 1,
		february: 2,
		march: 3,
		april: 4,
		may: 5,
		june: 6,
		july: 7,
		august: 8,
		september: 9,
		october: 10,
		november: 11,
		december: 12
	};

	export const getEthiopianYear = (year: number): string => {
		if (!year) return '';

		// Use January 1st to avoid Ethiopian new-year boundary issues
		const date = new Date(year, 0, 1);

		const formatter = new Intl.DateTimeFormat('am-ET', {
			year: 'numeric',
			calendar: 'ethiopic'
		});

		return formatter.format(date);
	};

	export const formatEthiopian = (year: number, monthName: string): string => {
		const month = MONTH_MAP[monthName.toLowerCase()];
		if (!month) return '';

		const date = new Date(year, month - 1, 1);

		const formatter = new Intl.DateTimeFormat('am-ET', {
			year: 'numeric',
			month: 'long',
			calendar: 'ethiopic'
		});

		return formatter.format(date);
	};

	// const formatted = $derived(
	// 	selectedYear
	// 		? formatEthiopian(Number(selectedYear), selectedMonth)
	// 		: formatEthiopianYearMonth(new Date().getFullYear(), new Date().getMonth() + 1)
	// );

	const formatted = $derived(value ? `${selectedMonth} ${selectedYear}` : 'Select month and year');
	const previousYear = () => (selectedYear ? (selectedYear -= 1) : 0);
	const nextYear = () => (selectedYear ? (selectedYear += 1) : 0);
</script>

<Popover bind:open={isOpen}>
	<PopoverTrigger class="w-full">
		<Button variant="outline" class="w-full justify-start text-left font-normal">
			<!-- {displayValue.replaceAll('_', ' ')} -->
			{formatted}
		</Button>
	</PopoverTrigger>

	<PopoverContent class="w-72 p-0" align="start">
		<div class="flex flex-col gap-4 p-4">
			<!-- month grid -->
			<div>
				<h3 class="mb-3 text-center text-sm font-semibold">{selectedYear}</h3>
				<div class="grid grid-cols-3 gap-2">
					{#each months as month, i}
						<Button
							variant={selectedMonth === month ? 'default' : 'outline'}
							size="sm"
							class="h-8"
							onclick={() => selectMonth(month)}
						>
							{month}
						</Button>
					{/each}
				</div>
			</div>

			<!-- year changer -->
			<div class="flex items-center justify-between border-t pt-2">
				<Button variant="ghost" size="sm" onclick={previousYear}>
					<ChevronLeftIcon class="size-4" />
				</Button>
				<span class="text-sm font-medium">{selectedYear}</span>
				<Button variant="ghost" size="sm" onclick={nextYear}>
					<ChevronRightIcon class="size-4" />
				</Button>
			</div>
		</div>
	</PopoverContent>
</Popover>
