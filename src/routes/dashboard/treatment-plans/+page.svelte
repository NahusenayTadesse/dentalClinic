<script lang="ts">
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import type { Stat } from '@nahu/admin-kit/components/reports/types.js';
	import PhoneCall from '@lucide/svelte/icons/phone-call';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { formatETB } from '$lib/global.svelte';
	import { columns } from './columns';

	/**
	 * Quotes awaiting an answer, longest-waiting first, and how the last quarter's quotes went.
	 *
	 * The rate is the share of quoted *value* agreed, among plans that have been answered; quotes
	 * still waiting are shown beside it rather than counted as a no.
	 */
	let { data } = $props();

	const a = $derived(data.acceptance);

	const TILES = $derived<Stat[]>([
		{
			key: 'rate',
			label: 'Case acceptance',
			value: a.rate ?? 0,
			format: 'percent',
			group: 'plans',
			hint:
				a.rate === null
					? `No quote answered in the last ${data.acceptanceDays} days`
					: `of quoted value, last ${data.acceptanceDays} days`
		},
		{
			key: 'agreed',
			label: 'Agreed',
			value: a.accepted,
			format: 'money',
			group: 'plans',
			hint: `of ${formatETB(a.quoted)} answered`
		},
		{
			key: 'waiting',
			label: 'Awaiting an answer',
			value: data.waiting.length,
			format: 'count',
			group: 'plans',
			hint: 'quotes still standing'
		},
		{
			key: 'expired',
			label: 'Expired unanswered',
			value: a.expired,
			format: 'count',
			group: 'plans',
			hint: `last ${data.acceptanceDays} days`
		}
	]);
</script>

<svelte:head>
	<title>Treatment plan follow-up</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">Treatment plan follow-up</h1>
		<p class="text-muted-foreground">
			Quotes shown to patients and not yet answered. Ring the longest-waiting first.
		</p>
	</header>

	<section
		class="grid grid-cols-2 gap-4 md:grid-cols-4"
		aria-label="Case acceptance, last {data.acceptanceDays} days"
	>
		{#each TILES as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</section>

	<Section title="Awaiting an answer" IconComp={PhoneCall} style="identityIcon">
		{#if data.waiting.length}
			<DataTable
				{columns}
				data={data.waiting}
				search
				fileName="plans-awaiting-answer"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">
				No quote is waiting for an answer at this branch. Plans are drawn up and presented from a
				patient’s <em>Treatment plans</em> tab.
			</p>
		{/if}
	</Section>
</div>
