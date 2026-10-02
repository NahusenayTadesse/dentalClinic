<script lang="ts">
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import type { Stat } from '@nahu/admin-kit/components/reports/types.js';
	import Building from '@lucide/svelte/icons/building-2';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import Vault from '@lucide/svelte/icons/vault';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { columns, payerColumns } from './columns';

	/**
	 * Billing across patients at this branch: who owes what, most owed first. A bill is raised and
	 * paid on the patient's own Billing tab; this is where the desk sees who to chase.
	 */
	let { data } = $props();

	const TILES = $derived<Stat[]>([
		{
			key: 'owed',
			label: 'Owed to the clinic',
			value: data.totalOwed,
			format: 'money',
			group: 'billing'
		},
		{
			key: 'owing',
			label: 'Patients who owe',
			value: data.owing.length,
			format: 'count',
			group: 'billing'
		},
		{
			key: 'awaiting',
			label: 'Bills waiting for a manager',
			value: data.awaitingManager,
			format: 'count',
			group: 'billing',
			tone: data.awaitingManager ? 'warning' : 'neutral'
		}
	]);
</script>

<svelte:head>
	<title>Billing</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-wrap items-end gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-extrabold tracking-tight">Billing</h1>
			<p class="text-muted-foreground">
				What patients at this branch still owe, and the employers and insurers who pay for some.
			</p>
		</div>
		{#if data.canCount}
			<Button href="/dashboard/billing/cash" variant="outline" class="ml-auto">
				<Vault class="size-4" /> Cash drawer
			</Button>
		{/if}
	</header>

	<section class="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Receivables">
		{#each TILES as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
	</section>
	{#if data.awaitingManager && data.canApprove}
		<a class="-mt-3 self-end text-sm underline" href="/dashboard/approvals/invoices">
			Open the bills waiting for a manager
		</a>
	{/if}

	<Section title="Who owes" IconComp={HandCoins} style="identityIcon">
		{#if data.owing.length}
			<DataTable {columns} data={data.owing} search fileName="receivables" height="auto" />
		{:else}
			<p class="text-sm text-muted-foreground">No patient at this branch owes anything.</p>
		{/if}
	</Section>

	{#if data.payers.length}
		<Section title="Payers who owe" IconComp={Building} style="identityIcon">
			<DataTable
				columns={payerColumns}
				data={data.payers}
				search
				fileName="payer-receivables"
				height="auto"
			/>
		</Section>
	{/if}
</div>
