<script lang="ts">
	import { onDestroy } from 'svelte';
	import ChartColumnBig from '@lucide/svelte/icons/chart-column-big';
	import ChartPie from '@lucide/svelte/icons/chart-pie';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import Activity from '@lucide/svelte/icons/activity';
	import * as Select from '$lib/components/ui/select/index.js';
	import type { Facet } from './table-state.svelte';

	/**
	 * The chart pane beside the table.
	 *
	 * **It draws the same tallies the column filters use, and that is the design.** A chart and a
	 * filter list that count separately will eventually disagree, and the one that is wrong is
	 * whichever the reader believed. Both read `facets` here, so the bar heights and the numbers
	 * in the popover cannot drift.
	 *
	 * That also settles where the numbers come from. In server mode `facets` arrives from
	 * `facetCounts` and describes the whole result set; in client mode it is counted off the rows,
	 * which *is* the whole result set. Either way the chart describes the data, not the page —
	 * which was not true of the component this replaces.
	 *
	 * Clicking a segment filters by it, because a chart that shows you something interesting and
	 * cannot take you to it is a picture rather than a control.
	 */
	let {
		facets,
		labels = {},
		selected = {},
		onToggle
	}: {
		/** Tally per filterable column, keyed the same way the filters are. */
		facets: Record<string, Facet[]>;
		/** Human wording per key; falls back to a de-camel-cased key. */
		labels?: Record<string, string>;
		selected?: Record<string, string[]>;
		onToggle: (key: string, value: string) => void;
	} = $props();

	type ChartType = 'bar' | 'pie' | 'doughnut' | 'line' | 'polarArea' | 'radar';

	const CHART_TYPES: { value: ChartType; label: string }[] = [
		{ value: 'bar', label: 'Bar' },
		{ value: 'pie', label: 'Pie' },
		{ value: 'doughnut', label: 'Doughnut' },
		{ value: 'line', label: 'Line' },
		{ value: 'polarArea', label: 'Polar area' },
		{ value: 'radar', label: 'Radar' }
	];

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

	const keys = $derived(Object.keys(facets).filter((k) => facets[k]?.length));

	let type = $state<ChartType>('bar');
	let activeKey = $state<string>('');

	const currentKey = $derived(activeKey && keys.includes(activeKey) ? activeKey : (keys[0] ?? ''));
	const current = $derived(facets[currentKey] ?? []);

	const label = (key: string) =>
		labels[key] ??
		key
			.replace(/Id$/, '')
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/^./, (c) => c.toUpperCase());

	const icon = $derived(
		type === 'pie' || type === 'doughnut'
			? ChartPie
			: type === 'line'
				? TrendingUp
				: type === 'radar' || type === 'polarArea'
					? Activity
					: ChartColumnBig
	);

	let canvas = $state<HTMLCanvasElement | null>(null);
	// Not `$state`: the Chart.js instance is a mutable external object, and making it reactive
	// would have every internal mutation it performs invalidate the effect that owns it.
	let chart: { destroy(): void; data: unknown; update(mode?: string): void } | null = null;
	let ChartCtor: (new (el: HTMLCanvasElement, cfg: unknown) => typeof chart) | null = null;

	function chartData() {
		return {
			labels: current.map((f) => f.label),
			datasets: [
				{
					label: label(currentKey),
					data: current.map((f) => f.count),
					backgroundColor: current.map((_, i) => `${PALETTE[i % PALETTE.length]}cc`),
					borderColor: current.map((_, i) => PALETTE[i % PALETTE.length]),
					borderWidth: 2,
					borderRadius: type === 'bar' ? 6 : 0,
					/*
					 * Chart.js divides the full width between the categories, so a facet with two
					 * values drew two slabs the width of half the panel each. Fine in the narrow
					 * side pane this replaced; absurd now the panel is full width.
					 */
					maxBarThickness: 72,
					hoverOffset: type === 'pie' || type === 'doughnut' ? 8 : 0
				}
			]
		};
	}

	function chartOptions() {
		const radial =
			type === 'pie' || type === 'doughnut' || type === 'polarArea' || type === 'radar';

		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: radial, position: 'bottom' as const, labels: { boxWidth: 12 } }
			},
			scales: radial ? {} : { y: { beginAtZero: true, ticks: { precision: 0 } } },
			onClick: (_: unknown, hits: { index: number }[]) => {
				if (!hits.length) return;
				const picked = current[hits[0].index];
				if (picked) onToggle(currentKey, picked.value);
			}
		};
	}

	/*
	 * One effect owns the instance for the whole of its life: it builds on the current canvas and
	 * tears down on the way out. Chart.js keeps a registry keyed by canvas and throws "Canvas is
	 * already in use" if a second instance is constructed over a live one, which is what happens
	 * if creation and destruction sit in different effects.
	 */
	$effect(() => {
		const el = canvas;
		const data = chartData();
		const options = chartOptions();

		if (!el || !current.length) return;

		let cancelled = false;

		(async () => {
			if (!ChartCtor) {
				// Loaded on demand: chart.js is the largest dependency here and most tables never
				// open this pane.
				const mod = await import('chart.js/auto');
				ChartCtor = mod.Chart as unknown as typeof ChartCtor;
			}
			if (cancelled || !ChartCtor) return;

			chart?.destroy();
			chart = new ChartCtor(el, { type, data, options }) as typeof chart;
		})();

		return () => {
			cancelled = true;
			chart?.destroy();
			chart = null;
		};
	});

	onDestroy(() => chart?.destroy());
</script>

{#if keys.length}
	<div class="flex h-full flex-col gap-3 p-3">
		<div class="flex flex-wrap items-center gap-2">
			<Select.Root type="single" bind:value={activeKey}>
				<Select.Trigger class="h-8 w-40 text-xs">{label(currentKey)}</Select.Trigger>
				<Select.Content>
					{#each keys as key (key)}
						<Select.Item value={key}>{label(key)}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root type="single" bind:value={type}>
				<Select.Trigger class="h-8 w-36 gap-1 text-xs" aria-label="Chart type">
					{@const Icon = icon}
					<Icon class="size-3.5" />
					{CHART_TYPES.find((t) => t.value === type)?.label}
				</Select.Trigger>
				<Select.Content>
					{#each CHART_TYPES as t (t.value)}
						<Select.Item value={t.value}>{t.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<div class="relative min-h-0 flex-1">
			<canvas bind:this={canvas} aria-label="{label(currentKey)} breakdown"></canvas>
		</div>

		{#if selected[currentKey]?.length}
			<p class="text-[11px] text-muted-foreground">
				Filtered by {current
					.filter((f) => selected[currentKey].includes(f.value))
					.map((f) => f.label)
					.join(', ')}
			</p>
		{/if}
	</div>
{/if}
