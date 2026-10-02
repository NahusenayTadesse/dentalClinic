<script lang="ts">
	import { page as pageState } from '$app/state';

	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { CalendarRange, LayoutGrid, Funnel, X } from '@lucide/svelte';

	import { formatEthiopianDate } from '$lib/global.svelte';
	import { REPORT_PAGES } from './sections';
	import { canVisit } from '$lib/routeAccess';
	import { CUSTOM_FILTER_KEYS, defaultRange, type CustomFilterKey } from './filters';
	import ReportFilters from './ReportFilters.svelte';
	import { reportHref } from './query';

	let { data, children } = $props();

	const filters = $derived(data.filters);

	const rangeLabel = $derived(
		`${formatEthiopianDate(new Date(filters.dateStart))} — ${formatEthiopianDate(new Date(filters.dateEnd))}`
	);

	const base = '/dashboard/reports';

	// Each report sits behind its own permission — HR reads people and leave, finance reads the
	// money ones, the audit log is its own. Only the reports this user may open are offered.
	const permList = $derived((pageState.data.permList ?? []) as string[]);
	const reportPages = $derived(REPORT_PAGES.filter((r) => canVisit(`${base}/${r.slug}`, permList)));
	const canSeeOverview = $derived(canVisit(base, permList));

	/** Keeps the whole query when moving between reports — only the path changes. */
	// The open ledger and the page cursor belong to the report being left.
	const suffix = $derived(reportHref(pageState.url, { section: null, page: null }, ''));

	const activeSlug = $derived(pageState.url.pathname.replace(`${base}/`, '').split('/')[0]);
	const isOverview = $derived(pageState.url.pathname === base);

	/**
	 * Twenty filters is a wall of controls to put above every report, so the
	 * panel starts closed and the button carries the count instead. The date
	 * range — the one filter that is always set — is spelled out in the header,
	 * so a closed panel never hides what the numbers are actually answering.
	 */
	let filtersOpen = $state(false);

	const fallbackRange = defaultRange();

	const activeFilterCount = $derived(
		[
			filters.search !== '',
			filters.dateStart !== fallbackRange.dateStart || filters.dateEnd !== fallbackRange.dateEnd,
			...CUSTOM_FILTER_KEYS.map((key) => {
				const value = filters[key as CustomFilterKey];
				return value !== null && value !== undefined && value !== '';
			})
		].filter(Boolean).length
	);
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Reports</h1>
			<p class="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
				<CalendarRange class="size-4" />
				{rangeLabel}
			</p>
		</div>

		<Button
			variant={filtersOpen ? 'secondary' : 'outline'}
			size="sm"
			aria-expanded={filtersOpen}
			onclick={() => (filtersOpen = !filtersOpen)}
		>
			{#if filtersOpen}
				<X class="size-4" />
				Hide filters
			{:else}
				<Funnel class="size-4" />
				Filters
			{/if}
			{#if activeFilterCount > 0}
				<Badge variant="secondary" class="ml-1">{activeFilterCount}</Badge>
			{/if}
		</Button>
	</div>

	<!-- The link map. Every report keeps the current query when you move to it,
	     so a filter set once follows you across the whole section. -->
	<nav aria-label="Reports" class="flex flex-wrap gap-2 border-b pb-4">
		{#if canSeeOverview}
			<Button
				href="{base}{suffix}"
				variant={isOverview ? 'default' : 'outline'}
				size="sm"
				aria-current={isOverview ? 'page' : undefined}
			>
				<LayoutGrid class="size-4" />
				Overview
			</Button>
		{/if}

		{#each reportPages as report (report.slug)}
			<Button
				href="{base}/{report.slug}{suffix}"
				variant={activeSlug === report.slug && !isOverview ? 'default' : 'outline'}
				size="sm"
				aria-current={activeSlug === report.slug && !isOverview ? 'page' : undefined}
			>
				{report.title}
			</Button>
		{/each}
	</nav>

	{#if filtersOpen}
		<ReportFilters filters={data.filters} options={data.filterOptions} />
	{/if}

	{@render children?.()}
</div>
