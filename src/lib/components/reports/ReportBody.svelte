<script lang="ts">
	import { goto } from '$app/navigation';
	import { page as pageState } from '$app/state';

	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import ReportChart from '@nahu/admin-kit/components/reports/ReportChart.svelte';

	import { navigateWithQuery } from '@nahu/admin-kit/queryFilters.js';
	import { reportHref } from '../../../routes/dashboard/reports/query';
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
	/** The ledger's columns with sorting off — see the table below. */
	const unsortable = $derived(columns.map((column) => ({ ...column, enableSorting: false })));
	const ledgers = $derived(sectionsInGroup(group));

	/**
	 * The table's own facet filter narrows the page in place, without a round
	 * trip. It has to start out holding the rows rather than empty: the data
	 * table reads its page size off the array length once, when it mounts, so a
	 * component seeded with `[]` would page zero rows and stay blank.
	 */
	const fileName = $derived(`${section.label} ${pageState.url.search}`.trim());

	function openLedger(next: string) {
		navigateWithQuery({ section: next, page: 1 });
	}

	/**
	 * A tile can point at a ledger that now lives on another report — payroll's
	 * overtime figure belongs to Compensation. Following the section to its own
	 * page keeps the number and the rows behind it in the same place.
	 */
	function openStat(next: string) {
		const target = pageForSection(next);
		const stays = ledgers.some((ledger) => ledger.key === next);

		if (stays) {
			navigateWithQuery({ section: next, page: 1 });
			return;
		}
		goto(
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- `resolve()` takes a route id; this is a built address on another report, keeping the query.
			reportHref(pageState.url, { section: next, page: 1 }, `/dashboard/reports/${target.slug}`)
		);
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

				<!--
					The kit's table in server mode: the ledger is paged and searched by the loader
					(`loadSection`), so the table's pager and search write the query. Its rows are one
					page, so they are not counted for column filters — the report's own filters narrow
					them, and they apply to the charts as well. Sorting is off: the loader orders each
					ledger itself, and arrows that reordered one page would mislead.
				-->
				{#key sectionKey}
					<DataTable
						data={detail.rows}
						columns={unsortable}
						{fileName}
						server={{
							pagination: { page: detail.page, pageSize: detail.pageSize, total: detail.total },
							filters: { search: pageState.url.searchParams.get('search') ?? '' }
						}}
					/>
				{/key}
			{/if}
		</CardContent>
	</Card>
</div>
