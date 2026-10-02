<script lang="ts">
	import { goto } from '$app/navigation';
	import { page as pageState } from '$app/state';

	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import ReportChart from '@nahu/admin-kit/components/reports/ReportChart.svelte';

	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Label from '@nahu/admin-kit/components/ui/label/label.svelte';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '@nahu/admin-kit/components/ui/select/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '@nahu/admin-kit/components/ui/card/index.js';
	import { TriangleAlert, Frown } from '@lucide/svelte';

	import { columnsFor } from '../../../routes/dashboard/reports/columns';
	import {
		pageForSection,
		sectionMeta,
		sectionsInGroup,
		type SectionGroup
	} from '../../../routes/dashboard/reports/sections';
	import type { ReportChartData, Stat } from '../../../routes/dashboard/reports/types';

	type Detail = {
		rows: Record<string, unknown>[];
		total: number;
		page: number;
		pageSize: number;
	};

	let {
		title,
		blurb,
		group,
		stats,
		charts,
		detail,
		section: sectionKey,
		failure = null
	}: {
		title: string;
		blurb: string;
		group: SectionGroup;
		stats: Stat[];
		charts: ReportChartData[];
		detail: Detail;
		section: string;
		failure?: string | null;
	} = $props();

	const section = $derived(sectionMeta(sectionKey));
	const columns = $derived(columnsFor(sectionKey));
	const ledgers = $derived(sectionsInGroup(group));

	/**
	 * The table's own facet filter narrows the page in place, without a round
	 * trip. It has to start out holding the rows rather than empty: the data
	 * table reads its page size off the array length once, when it mounts, so a
	 * component seeded with `[]` would page zero rows and stay blank.
	 */
	let filteredRows = $derived(detail.rows);

	const pageCount = $derived(Math.max(1, Math.ceil(detail.total / detail.pageSize)));
	const fileName = $derived(`${section.label} ${pageState.url.search}`.trim());

	function navigate(overrides: Record<string, string | number | null>, path?: string) {
		const params = new URLSearchParams(pageState.url.searchParams);

		for (const [key, value] of Object.entries(overrides)) {
			if (value === null || value === '') params.delete(key);
			else params.set(key, String(value));
		}

		goto(`${path ?? pageState.url.pathname}?${params.toString()}`, {
			keepFocus: true,
			noScroll: true
		});
	}

	function openLedger(next: string) {
		navigate({ section: next, page: 1 });
	}

	/**
	 * A tile can point at a ledger that now lives on another report — payroll's
	 * overtime figure belongs to Compensation. Following the section to its own
	 * page keeps the number and the rows behind it in the same place.
	 */
	function openStat(next: string) {
		const target = pageForSection(next);
		const stays = ledgers.some((ledger) => ledger.key === next);

		navigate({ section: next, page: 1 }, stays ? undefined : `/dashboard/reports/${target.slug}`);
	}
</script>

<svelte:head>
	<title>{title} Report</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<div>
		<h2 class="text-2xl font-semibold tracking-tight">{title}</h2>
		<p class="text-sm text-muted-foreground">{blurb}</p>
	</div>

	{#if failure}
		<div
			class="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
		>
			<TriangleAlert class="mt-0.5 size-4 shrink-0 text-amber-600" />
			<p>
				The figures for this report could not be worked out, so the tiles and charts are missing.
				The ledger below is unaffected.
			</p>
		</div>
	{/if}

	{#if stats.length}
		<div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
			{#each stats as stat (stat.key)}
				<StatCard {stat} onselect={openStat} />
			{/each}
		</div>
	{/if}

	{#if charts.length}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{#each charts as chart (chart.key)}
				<ReportChart {chart} />
			{/each}
		</div>
	{/if}

	<Card>
		<CardHeader>
			<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div>
					<CardTitle class="text-lg">{section.label}</CardTitle>
					<CardDescription>{section.description}</CardDescription>
				</div>

				{#if ledgers.length > 1}
					<div class="flex flex-col gap-2 sm:w-72">
						<Label class="text-sm font-medium">Open Ledger</Label>
						<Select type="single" value={sectionKey} onValueChange={openLedger}>
							<SelectTrigger class="w-full">{section.label}</SelectTrigger>
							<SelectContent class="max-h-80">
								{#each ledgers as ledger (ledger.key)}
									<SelectItem value={ledger.key}>{ledger.label}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>
				{/if}
			</div>
		</CardHeader>

		<CardContent class="flex flex-col gap-4">
			{#if detail.rows.length === 0}
				<div class="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<Frown class="size-12 animate-bounce text-muted-foreground" />
					<p class="text-xl">Nothing in {section.label} matches this query.</p>
					<p class="text-sm text-muted-foreground">
						Widen the date range or clear a filter to bring rows back.
					</p>
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">
					Showing {detail.rows.length} of {detail.total.toLocaleString()} rows.
				</p>

				<!-- Re-mounted whenever the query changes, so the table picks up the new
				     column set and re-reads its page size from the new row count. -->
				{#key `${sectionKey}-${detail.page}-${detail.pageSize}`}
					<FilterMenu
						data={detail.rows}
						bind:filteredList={filteredRows}
						filterKeys={section.filterKeys.filter((key) =>
							Object.prototype.hasOwnProperty.call(detail.rows[0] ?? {}, key)
						)}
					/>

					<DataTable data={filteredRows} {columns} {fileName} />
				{/key}

				{#if pageCount > 1}
					<div class="flex items-center justify-between text-sm text-muted-foreground">
						<span>Page {detail.page} of {pageCount}</span>
						<div class="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={detail.page <= 1}
								onclick={() => navigate({ page: detail.page - 1 })}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={detail.page >= pageCount}
								onclick={() => navigate({ page: detail.page + 1 })}
							>
								Next
							</Button>
						</div>
					</div>
				{/if}
			{/if}
		</CardContent>
	</Card>
</div>
