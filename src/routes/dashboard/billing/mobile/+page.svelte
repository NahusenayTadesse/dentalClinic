<script lang="ts">
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import type { Stat } from '@nahu/admin-kit/components/reports/types.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { transferColumns } from './columns';

	/**
	 * A day's mobile-money and bank transfers, to tick against the provider's statement. What stays
	 * unticked is money the desk recorded but nobody has yet seen arrive.
	 */
	let { data } = $props();
	const t = useI18n();
	const w = $derived(t.m.billing.mobile);

	const columns = $derived(transferColumns(t.m, data.canCheck));
	const total = $derived(data.totals.reduce((sum, l) => sum + l.total, 0));
	const unchecked = $derived(data.totals.reduce((sum, l) => sum + l.unchecked, 0));

	const TILES = $derived<Stat[]>([
		{ key: 'count', label: w.tileCount, value: data.rows.length, format: 'count', group: 'mobile' },
		{ key: 'total', label: w.tileTotal, value: total, format: 'money', group: 'mobile' },
		{
			key: 'unchecked',
			label: w.tileUnchecked,
			value: unchecked,
			format: 'money',
			group: 'mobile',
			tone: unchecked > 0 ? 'warning' : 'neutral',
			hint: data.totals
				.filter((l) => l.unchecked > 0)
				.map((l) => `${l.method}: ${formatETB(l.unchecked)}`)
				.join(' · ')
		}
	]);
</script>

<svelte:head>
	<title>{w.title}</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">{w.title}</h1>
		<p class="text-muted-foreground">{w.blurb}</p>
	</header>

	<section class="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label={w.title}>
		{#each TILES as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</section>

	<Section
		title={formatEthiopianDate(new Date(`${data.day}T12:00:00Z`))}
		IconComp={Smartphone}
		style="identityIcon"
	>
		{#snippet editDialog()}
			<div class="ml-auto flex flex-wrap gap-1" role="group">
				<Button
					size="sm"
					variant="outline"
					href="?date={data.previousDay}"
					aria-label={t.m.common.dayBefore}
				>
					<ChevronLeft class="size-4" />
				</Button>
				<Button
					size="sm"
					variant={data.day === data.today ? 'default' : 'outline'}
					href="?date={data.today}">{t.m.common.today}</Button
				>
				<Button
					size="sm"
					variant="outline"
					href="?date={data.nextDay}"
					aria-label={t.m.common.dayAfter}
				>
					<ChevronRight class="size-4" />
				</Button>
			</div>
		{/snippet}
		{#if data.rows.length}
			<DataTable
				{columns}
				data={data.rows}
				facetKeys={['method', 'checked']}
				facetLabels={{ method: w.method, checked: w.checked }}
				search
				fileName="transfers-{data.day}"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">{w.empty}</p>
		{/if}
	</Section>
</div>
