<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		SlidersHorizontal,
		RotateCcw,
		X,
		Check,
		ChevronsUpDown,
		BarChart2,
		PieChart,
		TrendingUp,
		Activity,
		ChartArea,
		ChartPie,
		ChartColumnBig
	} from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import { Checkbox } from 'bits-ui';
	import { Label } from '$lib/components/ui/label/index';
	import { Badge } from '$lib/components/ui/badge/index';
	import Button from '$lib/components/ui/button/button.svelte';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '$lib/components/ui/card';
	import pluralize from 'pluralize';
	import { toast } from 'svelte-sonner';
	import { fly, fade } from 'svelte/transition';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	type ChartType = 'bar' | 'pie' | 'doughnut' | 'line' | 'polarArea' | 'radar';

	interface Props {
		data: any[];
		filterKeys: string[];
		filteredList?: any[];
		class?: string;
	}

	let { data, filterKeys, filteredList = $bindable(data), class: className = '' }: Props = $props();

	// ── Chart type selector ──────────────────────────────────────────────────
	const CHART_TYPES: { value: ChartType; label: string }[] = [
		{ value: 'bar', label: 'Bar' },
		{ value: 'line', label: 'Line' },
		{ value: 'pie', label: 'Pie' },
		{ value: 'doughnut', label: 'Doughnut' },
		{ value: 'polarArea', label: 'Polar Area' },
		{ value: 'radar', label: 'Radar' }
	];

	let type = $state<ChartType>();
	let chartTypeOpen = $state(false);

	// ── State ───────────────────────────────────────────────────────────────
	let selectedFilters = $state<Record<string, string[]>>({});
	let filtersOpen = $state(false);
	let chartOpen = $state(false);
	let activeChartKey = $derived<string>(filterKeys[0] ?? '');
	let chartCanvases = $state<Record<string, HTMLCanvasElement | null>>({});
	let chartInstances: Record<string, any> = {};

	// ── Init filters ────────────────────────────────────────────────────────
	$effect(() => {
		filterKeys.forEach((key) => {
			if (!(key in selectedFilters)) selectedFilters[key] = [];
		});
	});

	// ── Helpers ─────────────────────────────────────────────────────────────
	const humanLabel = (key: string) =>
		pluralize(key)
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/^\w/, (c) => c.toUpperCase());

	const getDistinctValues = (key: string): string[] =>
		Array.from(
			new Set(data.map((item: any) => item[key]).filter((v) => v !== undefined && v !== null))
		)
			.map(String)
			.sort();

	// Count matching items for a specific (key, value) respecting all OTHER active filters
	const getCountForValue = (filterKey: string, value: string) =>
		data.filter((item: any) =>
			filterKeys.every((key) => {
				if (key === filterKey) return String(item[key]) === value;
				const sel = selectedFilters[key];
				return sel.length === 0 || sel.includes(String(item[key]));
			})
		).length;

	const toggleFilterValue = (key: string, value: string) => {
		const cur = selectedFilters[key];
		selectedFilters[key] = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
	};

	const isValueSelected = (key: string, value: string) =>
		selectedFilters[key]?.includes(value) ?? false;

	// ── Filtered list ────────────────────────────────────────────────────────
	$effect(() => {
		filteredList = data.filter((item: any) =>
			filterKeys.every((key) => {
				const sel = selectedFilters[key];
				return sel.length === 0 || sel.includes(String(item[key]));
			})
		);
	});

	// ── Reset ────────────────────────────────────────────────────────────────
	let isResetting = $state(false);
	const resetFilters = () => {
		isResetting = true;
		selectedFilters = {};
		filterKeys.forEach((key) => (selectedFilters[key] = []));
		filteredList = data;
		toast.success('Filters reset');
		isResetting = false;
	};

	const activeFilterCount = $derived(
		Object.values(selectedFilters).reduce((acc, arr) => acc + arr.length, 0)
	);

	// ── Chart colours ─────────────────────────────────────────────────────────
	const PALETTE = [
		'#6366f1',
		'#22d3ee',
		'#f59e0b',
		'#10b981',
		'#f43f5e',
		'#8b5cf6',
		'#14b8a6',
		'#fb923c',
		'#3b82f6',
		'#ec4899'
	];

	const buildChartData = (key: string) => {
		const values = getDistinctValues(key);
		const counts = values.map((v) => getCountForValue(key, v));
		return {
			labels: values,
			datasets: [
				{
					label: humanLabel(key),
					data: counts,
					backgroundColor: values.map((_, i) => PALETTE[i % PALETTE.length] + 'cc'),
					borderColor: values.map((_, i) => PALETTE[i % PALETTE.length]),
					borderWidth: 2,
					borderRadius: type === 'bar' ? 6 : 0,
					hoverOffset: type === 'pie' || type === 'doughnut' ? 8 : 0
				}
			]
		};
	};

	const buildChartOptions = (key: string) => ({
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: type === 'pie' || type === 'doughnut' || type === 'polarArea',
				position: 'bottom' as const,
				labels: { color: 'hsl(var(--foreground))', font: { size: 12 }, padding: 16 }
			},
			tooltip: {
				callbacks: {
					label: (ctx: any) =>
						` ${ctx.label}: ${filteredList.filter((c) => c[key] === ctx.label)?.length} items`
				}
			}
		},
		scales:
			type === 'bar' || type === 'line'
				? {
						x: {
							ticks: { color: 'hsl(var(--muted-foreground))', font: { size: 11 } },
							grid: { color: 'hsl(var(--border))' }
						},
						y: {
							ticks: { color: 'hsl(var(--muted-foreground))', font: { size: 11 } },
							grid: { color: 'hsl(var(--border))' },
							beginAtZero: true
						}
					}
				: {},
		onClick: (_: any, elements: any[]) => {
			if (!elements.length) return;
			const idx = elements[0].index;
			const values = getDistinctValues(key);
			const clicked = values[idx];
			toggleFilterValue(key, clicked);
		}
	});

	// ── Render / update charts ───────────────────────────────────────────────
	let Chart: any;

	onMount(async () => {
		const mod = await import('chart.js/auto');
		Chart = mod.Chart;
		renderAllCharts();
	});

	onDestroy(() => {
		Object.values(chartInstances).forEach((c) => c?.destroy());
	});

	const renderAllCharts = () => {
		filterKeys.forEach((key) => {
			const canvas = chartCanvases[key];
			if (!canvas || !Chart) return;
			chartInstances[key]?.destroy();
			chartInstances[key] = new Chart(canvas, {
				type,
				data: buildChartData(key),
				options: buildChartOptions(key)
			});
		});
	};

	// Re-render whenever filters or active chart key changes
	$effect(() => {
		void activeFilterCount;
		void activeChartKey;
		if (!Chart) return;
		filterKeys.forEach((key) => {
			const inst = chartInstances[key];
			if (!inst) return;
			inst.data = buildChartData(key);
			inst.update('active');
		});
	});

	// Full re-render when chart type changes
	$effect(() => {
		void type;
		if (Chart) renderAllCharts();
	});

	// ── Icon helper ──────────────────────────────────────────────────────────
	const chartTypeIcon = (t: ChartType) => {
		if (t === 'pie' || t === 'doughnut') return ChartPie;
		if (t === 'line') return TrendingUp;
		if (t === 'radar' || t === 'polarArea') return Activity;
		return ChartColumnBig;
	};
	const ChartIcon = $derived(chartTypeIcon(type));
</script>

<!-- ── Toolbar ────────────────────────────────────────────────────────────── -->
<div class="flex {className} flex-wrap items-center gap-2">
	<!-- Filter toggle -->

	<div class="items-between flex w-full flex-row flex-wrap justify-between">
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger class={buttonVariants({ variant: 'outline' })}>
					{#snippet child(props)}
						<Button onclick={() => (filtersOpen = !filtersOpen)} class="w-40" {...props}>
							{#if filtersOpen}
								<X class="size-4" />
							{:else}
								<SlidersHorizontal class="size-4" />
							{/if}
							Table Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content><p>Filter Charts</p></Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		<div>
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger class={buttonVariants({ variant: 'outline' })}>
						{#snippet child(props)}
							<Button
								onclick={() => {
									chartOpen = !chartOpen;
									type = 'bar';
								}}
								class="w-40"
								{...props}
							>
								{#if chartOpen}
									<X class="size-4" />
								{:else}
									<ChartArea class="size-4" />
								{/if}
								Chart {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content><p>Filter Charts</p></Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		</div>
	</div>
	<!-- Chart type picker -->
</div>

<!-- ── Filter panel ───────────────────────────────────────────────────────── -->
{#if filtersOpen}
	<div class="mt-4" transition:fly={{ x: -100, duration: 300 }}>
		<Card class="w-full">
			<CardHeader>
				<CardTitle>Filter Charts</CardTitle>
				<CardDescription>Narrow the data shown in each chart</CardDescription>
			</CardHeader>
			<CardContent>
				<div
					class="space-y-2 rounded-xl border border-border/50 bg-background bg-linear-to-br from-card to-card/50 p-6 shadow-sm"
				>
					<!-- header row -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<SlidersHorizontal class="size-5 text-primary" />
							<h3 class="text-base font-semibold">Filters</h3>
							{#if activeFilterCount > 0}
								<Badge variant="secondary" class="ml-2">{activeFilterCount} active</Badge>
							{/if}
						</div>
						<Button
							variant="outline"
							size="sm"
							class="gap-2 hover:bg-destructive/10 hover:text-destructive"
							onclick={resetFilters}
						>
							<RotateCcw class="size-4 {isResetting ? 'animate-spin' : ''}" />
							<span class="hidden sm:inline">Reset</span>
						</Button>
					</div>

					<!-- filter controls -->
					<div class="flex flex-row flex-wrap gap-4">
						{#each filterKeys as filterKey (filterKey)}
							<div class="min-w-50 space-y-2">
								<Label class="text-sm font-medium capitalize">{humanLabel(filterKey)}</Label>

								<Popover.Root>
									<Popover.Trigger class="w-full">
										{#snippet child({ props })}
											<Button
												variant="outline"
												role="combobox"
												class="w-full justify-between"
												{...props}
											>
												<span class="truncate">
													{#if selectedFilters[filterKey]?.length === 0}
														<span class="text-muted-foreground">All {humanLabel(filterKey)}</span>
													{:else if selectedFilters[filterKey]?.length === 1}
														<span class="font-medium">{selectedFilters[filterKey][0]}</span>
													{:else}
														<span class="font-medium"
															>{selectedFilters[filterKey].length} selected</span
														>
													{/if}
												</span>
												<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
											</Button>
										{/snippet}
									</Popover.Trigger>
									<Popover.Content class="w-50 p-0">
										<Command.Root>
											<Command.Input placeholder={`Search ${pluralize(filterKey)}...`} />
											<Command.List>
												<Command.Empty>No {pluralize(filterKey)} found.</Command.Empty>
												<Command.Group>
													{#each getDistinctValues(filterKey) as value}
														<Command.Item
															{value}
															onSelect={() => toggleFilterValue(filterKey, value)}
															class="flex cursor-pointer items-center gap-2"
														>
															<Checkbox.Root
																checked={isValueSelected(filterKey, value)}
																class="flex size-4 items-center justify-center rounded-sm border border-primary/50"
															>
																{#snippet children({ checked })}
																	{#if checked}<Check class="size-3.5 text-primary" />{/if}
																{/snippet}
															</Checkbox.Root>
															<span class="flex-1 capitalize">{value}</span>
															<span class="text-xs text-muted-foreground">
																({getCountForValue(filterKey, value)})
															</span>
														</Command.Item>
													{/each}
												</Command.Group>
											</Command.List>
										</Command.Root>
									</Popover.Content>
								</Popover.Root>

								<!-- active badges -->
								{#if selectedFilters[filterKey]?.length > 0}
									<div class="mt-2 flex flex-wrap gap-1">
										{#each selectedFilters[filterKey] as selectedValue}
											<Badge variant="secondary" class="gap-1 pr-1">
												{selectedValue}
												<button
													class="ml-1 hover:text-destructive"
													onclick={() => toggleFilterValue(filterKey, selectedValue)}
												>
													<X class="size-3" />
												</button>
											</Badge>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<!-- results count -->
				<div class="mt-4 flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
					<p class="text-sm text-muted-foreground">
						Showing <span class="font-semibold text-foreground">{filteredList.length}</span> of
						<span class="font-semibold text-foreground">{data.length}</span> records
					</p>
					{#if activeFilterCount > 0}
						<p class="text-xs text-muted-foreground">
							{activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
						</p>
					{/if}
				</div>
			</CardContent>
		</Card>
	</div>
{/if}

<!-- ── Chart tabs ─────────────────────────────────────────────────────────── -->
{#if chartOpen}
	<div class="mt-6 space-y-4" transition:fly={{ x: 100, duration: 300 }}>
		<Popover.Root bind:open={chartTypeOpen}>
			<Popover.Trigger class={buttonVariants({ variant: 'outline' })}>
				{#snippet child({ props })}
					<Button variant="outline" class="w-44 justify-between" {...props}>
						<span class="flex items-center gap-2">
							<ChartIcon class="size-4 text-primary" />
							<span>{CHART_TYPES.find((c) => c.value === type)?.label ?? 'Chart Type'}</span>
						</span>
						<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content class="w-44 p-0">
				<Command.Root>
					<Command.List>
						<Command.Group>
							{#each CHART_TYPES as ct}
								<Command.Item
									value={ct.value}
									onSelect={() => {
										type = ct.value;
										chartTypeOpen = false;
									}}
									class="flex cursor-pointer items-center gap-2"
								>
									<Check
										class="size-4 {type === ct.value ? 'text-primary opacity-100' : 'opacity-0'}"
									/>
									{ct.label}
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.List>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>

		<!-- tab strip -->
		<div class="flex gap-2 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1">
			{#each filterKeys as key (key)}
				<button
					class="flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200
					{activeChartKey === key
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => (activeChartKey = key)}
				>
					<ChartIcon class="size-4" />
					{humanLabel(key)}
					{#if selectedFilters[key]?.length > 0}
						<Badge variant="secondary" class="ml-1 px-1.5 py-0 text-xs">
							{selectedFilters[key].length}
						</Badge>
					{/if}
				</button>
			{/each}
		</div>

		<!-- chart panels — all rendered but only active one is visible (keeps Chart.js instances alive) -->
		{#each filterKeys as key (key)}
			<div class={activeChartKey === key ? 'block' : 'hidden'}>
				<Card class="w-full">
					<CardHeader>
						<div class="flex items-center justify-between">
							<div>
								<CardTitle class="flex items-center gap-2">
									<ChartIcon class="size-5 text-primary" />
									{humanLabel(key)}
								</CardTitle>
								<CardDescription class="mt-1">
									Distribution of {humanLabel(key).toLowerCase()} across
									{filteredList.length} record{filteredList.length !== 1 ? 's' : ''}
									{#if selectedFilters[key]?.length > 0}
										· <span class="text-primary"
											>{selectedFilters[key].length} value{selectedFilters[key].length > 1
												? 's'
												: ''} highlighted</span
										>
									{/if}
								</CardDescription>
							</div>
							<Badge variant="outline" class="capitalize">{type}</Badge>
						</div>
					</CardHeader>
					<CardContent>
						<!-- tip: click a bar/slice to toggle that filter -->
						{#if type === 'bar' || type === 'line'}
							<p class="mb-3 text-xs text-muted-foreground">
								💡 Click a bar to toggle that value as a filter
							</p>
						{:else}
							<p class="mb-3 text-xs text-muted-foreground">
								💡 Click a segment to toggle that value as a filter
							</p>
						{/if}
						<div class="relative h-72 w-full">
							<canvas bind:this={chartCanvases[key]}></canvas>
						</div>
					</CardContent>
				</Card>
			</div>
		{/each}
	</div>
{/if}
