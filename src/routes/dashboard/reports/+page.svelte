<script lang="ts">
	import { page as pageState } from '$app/state';

	import StatCard from '$lib/components/reports/StatCard.svelte';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle
	} from '@nahu/admin-kit/components/ui/card/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { ArrowRight } from '@lucide/svelte';

	import { REPORT_PAGES } from './sections';

	let { data } = $props();

	/** Carries the current filters through to whichever report is opened. */
	const suffix = $derived.by(() => {
		const params = new URLSearchParams(pageState.url.searchParams);
		params.delete('section');
		params.delete('page');
		const query = params.toString();
		return query ? `?${query}` : '';
	});

	const byGroup = $derived(
		REPORT_PAGES.map((report) => ({
			report,
			stats: data.stats.filter((stat) => stat.group === report.group)
		}))
	);
</script>

<svelte:head>
	<title>Reports</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div>
		<h2 class="text-2xl font-semibold tracking-tight">Overview</h2>
		<p class="text-sm text-muted-foreground">
			The headline figure from each report, for the range and filters above. Open a report for its
			charts and the rows behind the numbers.
		</p>
	</div>

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
		{#each byGroup as { report, stats } (report.slug)}
			<Card class="flex flex-col">
				<CardHeader class="pb-3">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<CardTitle class="text-lg">{report.title}</CardTitle>
							<p class="mt-1 text-sm text-muted-foreground">{report.blurb}</p>
						</div>
						<Button
							href="/dashboard/reports/{report.slug}{suffix}"
							variant="outline"
							size="sm"
							class="shrink-0"
						>
							Open
							<ArrowRight class="size-4" />
						</Button>
					</div>
				</CardHeader>

				<CardContent class="flex-1">
					{#if stats.length}
						<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
							{#each stats as stat (stat.key)}
								<StatCard {stat} />
							{/each}
						</div>
					{:else}
						<p
							class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground"
						>
							These figures could not be worked out — open the report for details.
						</p>
					{/if}
				</CardContent>
			</Card>
		{/each}
	</div>
</div>
