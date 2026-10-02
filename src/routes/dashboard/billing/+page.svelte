<script lang="ts">
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import type { Stat } from '@nahu/admin-kit/components/reports/types.js';
	import Building from '@lucide/svelte/icons/building-2';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import Vault from '@lucide/svelte/icons/vault';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { payerColumns, receivableColumns } from './columns';

	/**
	 * Billing across patients at this branch: who owes what, most owed first. A bill is raised and
	 * paid on the patient's own Billing tab; this is where the desk sees who to chase.
	 */
	let { data } = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.owes);
	const columns = $derived(receivableColumns(t.m));
	const payerCols = $derived(payerColumns(t.m));

	const TILES = $derived<Stat[]>([
		{
			key: 'owed',
			label: w.owedToClinic,
			value: data.totalOwed,
			format: 'money',
			group: 'billing'
		},
		{
			key: 'owing',
			label: w.patientsWhoOwe,
			value: data.owing.length,
			format: 'count',
			group: 'billing'
		},
		{
			key: 'awaiting',
			label: w.billsAwaiting,
			value: data.awaitingManager,
			format: 'count',
			group: 'billing',
			tone: data.awaitingManager ? 'warning' : 'neutral'
		}
	]);
</script>

<svelte:head>
	<title>{w.title}</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-wrap items-end gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-extrabold tracking-tight">{w.title}</h1>
			<p class="text-muted-foreground">{w.blurb}</p>
		</div>
		{#if data.canCount}
			<Button href="/dashboard/billing/cash" variant="outline" class="ml-auto">
				<Vault class="size-4" />
				{w.cashDrawer}
			</Button>
		{/if}
	</header>

	<section class="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label={w.receivables}>
		{#each TILES as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</section>
	{#if data.awaitingManager && data.canApprove}
		<a class="-mt-3 self-end text-sm underline" href="/dashboard/approvals/invoices">
			{w.openAwaiting}
		</a>
	{/if}

	<Section title={w.whoOwes} IconComp={HandCoins} style="identityIcon">
		{#if data.owing.length}
			<DataTable {columns} data={data.owing} search fileName="receivables" height="auto" />
		{:else}
			<p class="text-sm text-muted-foreground">{w.nobodyOwes}</p>
		{/if}
	</Section>

	{#if data.payers.length}
		<Section title={w.payersWhoOwe} IconComp={Building} style="identityIcon">
			<DataTable
				columns={payerCols}
				data={data.payers}
				search
				fileName="payer-receivables"
				height="auto"
			/>
		</Section>
	{/if}
</div>
