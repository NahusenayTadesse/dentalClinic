<script lang="ts">
	import { onDestroy } from 'svelte';
	import { mode } from 'mode-watcher';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Table2, ChartColumnBig } from '@lucide/svelte';
	import { formatETB } from '$lib/global.svelte';
	import { THEME, fade, type ThemeName } from './palette';
	import type { ReportChartData } from '../../../routes/dashboard/reports/types';

	let { chart }: { chart: ReportChartData } = $props();

	const CATEGORICAL = new Set(['doughnut', 'pie', 'polarArea']);

	let canvas = $state<HTMLCanvasElement | null>(null);
	let instance: { destroy: () => void } | null = null;
	/**
	 * The table view is the relief the palette's contrast warning requires, and
	 * the accessible fallback for anyone who cannot read the colours at all.
	 */
	let showTable = $state(false);

	const theme = $derived<ThemeName>(mode.current === 'dark' ? 'dark' : 'light');
	const tokens = $derived(THEME[theme]);
	const isEmpty = $derived(
		chart.labels.length === 0 || chart.series.every((s) => s.data.every((v) => !v))
	);

	function money(value: number): string {
		return formatETB(value, true);
	}

	function compact(value: number): string {
		const abs = Math.abs(value);
		if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
		if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
		return String(Math.round(value * 100) / 100);
	}

	function datasets() {
		const colours = tokens.series;

		// One series per colour on a series chart; one colour per slice on a
		// categorical one, where the categories — not the series — carry identity.
		if (CATEGORICAL.has(chart.kind)) {
			return chart.series.map((series) => ({
				label: series.label,
				data: series.data,
				backgroundColor: chart.labels.map((_, index) => colours[index % colours.length]),
				borderColor: tokens.surface,
				borderWidth: 2,
				hoverOffset: 10
			}));
		}

		return chart.series.map((series, index) => {
			const colour = colours[index % colours.length];
			const asLine = series.type === 'line' || chart.kind === 'line' || chart.kind === 'area';

			return {
				label: series.label,
				data: series.data,
				type: series.type ?? undefined,
				backgroundColor: chart.kind === 'area' ? fade(colour, 0.18) : asLine ? colour : colour,
				borderColor: colour,
				borderWidth: 2,
				fill: chart.kind === 'area',
				tension: asLine ? 0.3 : 0,
				// A 4px rounded data-end reads as a bar end without thickening the mark.
				borderRadius: asLine ? 0 : 4,
				borderSkipped: false,
				pointRadius: asLine ? 4 : 0,
				pointHoverRadius: asLine ? 8 : 0,
				pointBackgroundColor: colour,
				pointBorderColor: tokens.surface,
				pointBorderWidth: 2,
				maxBarThickness: 34
			};
		});
	}

	function options() {
		const scaled = !CATEGORICAL.has(chart.kind) && chart.kind !== 'radar';

		return {
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: scaled ? ('index' as const) : ('nearest' as const), intersect: false },
			plugins: {
				legend: {
					// A single series is already named by the card title, so a legend box
					// would only repeat it. Two or more must never be told apart by colour
					// alone.
					display: CATEGORICAL.has(chart.kind) || chart.series.length > 1,
					position: 'bottom' as const,
					labels: {
						color: tokens.muted,
						boxWidth: 10,
						boxHeight: 10,
						usePointStyle: true,
						pointStyle: 'circle' as const,
						padding: 14,
						font: { size: 12 }
					}
				},
				tooltip: {
					backgroundColor: tokens.surface,
					titleColor: tokens.text,
					bodyColor: tokens.muted,
					borderColor: tokens.grid,
					borderWidth: 1,
					padding: 10,
					displayColors: true,
					usePointStyle: true,
					callbacks: {
						label: (item: { dataset: { label?: string }; parsed: { y?: number } | number }) => {
							const raw = typeof item.parsed === 'number' ? item.parsed : (item.parsed?.y ?? 0);
							const value = chart.money ? money(raw) : compact(raw);
							return ` ${item.dataset.label ?? ''}: ${value}`;
						}
					}
				}
			},
			scales: scaled
				? {
						x: {
							stacked: chart.stacked ?? false,
							ticks: { color: tokens.muted, font: { size: 11 }, maxRotation: 45, autoSkip: true },
							grid: { display: false },
							border: { color: tokens.grid }
						},
						y: {
							stacked: chart.stacked ?? false,
							ticks: {
								color: tokens.muted,
								font: { size: 11 },
								callback: (value: number | string) => compact(Number(value))
							},
							grid: { color: tokens.grid, drawTicks: false },
							border: { display: false }
						}
					}
				: {}
		};
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let ChartCtor: any = null;

	/**
	 * Chart.js touches `window` on import, so it is loaded in the effect rather
	 * than at module scope — the report renders on the server first.
	 */
	$effect(() => {
		// Re-runs whenever the data, the theme, or the visibility of the canvas
		// changes; the whole chart is rebuilt because switching theme changes
		// every colour on it anyway.
		void chart;
		void theme;
		const target = canvas;
		if (!target || showTable || isEmpty) return;

		let cancelled = false;

		(async () => {
			if (!ChartCtor) {
				const module = await import('chart.js/auto');
				ChartCtor = module.default ?? module.Chart;
			}
			if (cancelled || !canvas) return;

			instance?.destroy();
			instance = new ChartCtor(canvas, {
				type: chart.kind === 'area' ? 'line' : chart.kind,
				data: { labels: chart.labels, datasets: datasets() },
				options: options()
			});
		})();

		return () => {
			cancelled = true;
			instance?.destroy();
			instance = null;
		};
	});

	onDestroy(() => instance?.destroy());
</script>

<Card class="{chart.wide ? 'lg:col-span-2' : ''} flex flex-col">
	<CardHeader class="pb-2">
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0">
				<CardTitle class="text-base">{chart.title}</CardTitle>
				{#if chart.description}
					<CardDescription class="text-xs">{chart.description}</CardDescription>
				{/if}
			</div>
			<Button
				variant="ghost"
				size="sm"
				class="shrink-0 text-muted-foreground"
				aria-label={showTable ? 'Show chart' : 'Show values as a table'}
				onclick={() => (showTable = !showTable)}
			>
				{#if showTable}
					<ChartColumnBig class="size-4" />
				{:else}
					<Table2 class="size-4" />
				{/if}
			</Button>
		</div>
	</CardHeader>

	<CardContent class="flex-1">
		{#if isEmpty}
			<div
				class="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
			>
				Nothing recorded for this filter
			</div>
		{:else if showTable}
			<div class="max-h-72 overflow-auto rounded-md border">
				<table class="w-full text-sm">
					<thead class="sticky top-0 bg-muted/60 text-left">
						<tr>
							<th class="px-3 py-2 font-medium"></th>
							{#each chart.series as series (series.label)}
								<th class="px-3 py-2 text-right font-medium">{series.label}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each chart.labels as label, index (label + index)}
							<tr class="border-t">
								<td class="px-3 py-1.5">{label}</td>
								{#each chart.series as series (series.label)}
									<td class="px-3 py-1.5 text-right tabular-nums">
										{chart.money
											? money(series.data[index] ?? 0)
											: (series.data[index] ?? 0).toLocaleString()}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="h-72">
				<canvas bind:this={canvas} aria-label="{chart.title} — chart"></canvas>
			</div>
		{/if}
	</CardContent>
</Card>
