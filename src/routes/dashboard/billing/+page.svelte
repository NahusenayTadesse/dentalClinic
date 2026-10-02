<script lang="ts">
	import Building from '@lucide/svelte/icons/building-2';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import Vault from '@lucide/svelte/icons/vault';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { formatETB } from '$lib/global.svelte';
	import { columns, payerColumns } from './columns';

	/**
	 * Billing across patients at this branch: who owes what, most owed first. A bill is raised and
	 * paid on the patient's own Billing tab; this is where the desk sees who to chase.
	 */
	let { data } = $props();
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
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Owed to the clinic</p>
			<p class="text-2xl font-bold tabular-nums">{formatETB(data.totalOwed)}</p>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Patients who owe</p>
			<p class="text-2xl font-bold tabular-nums">{data.owing.length}</p>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Bills waiting for a manager</p>
			<p class="text-2xl font-bold tabular-nums">{data.awaitingManager}</p>
			{#if data.awaitingManager && data.canApprove}
				<a class="text-xs underline" href="/dashboard/approvals/invoices">Open the queue</a>
			{/if}
		</div>
	</section>

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
