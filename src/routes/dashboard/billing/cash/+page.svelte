<script lang="ts">
	import History from '@lucide/svelte/icons/history';
	import Vault from '@lucide/svelte/icons/vault';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatETB } from '$lib/global.svelte';
	import { ethiopianDateTime } from '$lib/tableCells';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { countColumns } from './columns';
	import { closeDrawerForm, openDrawerForm } from './schema';

	/**
	 * The cash drawer at this branch. Open it with the float; through the day it says what it should
	 * hold; count it and close it at night. A count that is off asks why before it will close.
	 */
	let { data } = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.cash);
	const columns = $derived(countColumns(t.m));

	let openOpen = $state(false);
	let closeOpen = $state(false);
</script>

<svelte:head>
	<title>{w.title}</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">{w.title}</h1>
		<p class="text-muted-foreground">{w.blurb}</p>
	</header>

	<Section title={data.open ? w.open : w.closed} IconComp={Vault} style="identityIcon">
		{#if !data.branchChosen}
			<p class="text-sm text-muted-foreground">{w.chooseBranch}</p>
		{:else if data.open}
			<dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
				<div>
					<dt class="text-muted-foreground">{w.opened}</dt>
					<dd>{ethiopianDateTime(data.open.openedAt)} · {data.open.openedBy ?? '—'}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">{w.float}</dt>
					<dd class="tabular-nums">{formatETB(data.open.openingFloat)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">{w.cashTaken}</dt>
					<dd class="tabular-nums">
						{formatETB(data.open.cashIn)} · {w.payments(data.open.payments)}
					</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">{w.shouldHold}</dt>
					<dd class="text-lg font-semibold tabular-nums">{formatETB(data.open.expected)}</dd>
				</div>
			</dl>
			<div class="mt-4 flex justify-end">
				<Button onclick={() => (closeOpen = true)}>{w.countAndClose}</Button>
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">{w.closedText}</p>
			<div class="mt-4 flex justify-end">
				<Button onclick={() => (openOpen = true)}>{w.openTheDrawer}</Button>
			</div>
		{/if}
	</Section>

	<Section title={w.recentCounts} IconComp={History} style="systemIcon">
		{#if data.closed.length}
			<DataTable {columns} data={data.closed} fileName="cash-counts" height="auto" />
		{:else}
			<p class="text-sm text-muted-foreground">{w.noCounts}</p>
		{/if}
	</Section>
</div>

<FormDialog
	title={w.openTheDrawer}
	action="?/open"
	data={data.forms.open}
	schema={openDrawerForm}
	bind:open={openOpen}
	hideTrigger
	submitLabel={w.openSubmit}
>
	{#snippet fields({ form, errors })}
		<InputComp
			label={w.floatLabel}
			name="openingFloat"
			type="number"
			step="0.01"
			min="0"
			{form}
			{errors}
			description={w.floatHint}
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title={w.countAndClose}
	description={w.closeDescription(formatETB(data.open?.expected ?? 0))}
	action="?/close"
	data={data.forms.close}
	schema={closeDrawerForm}
	bind:open={closeOpen}
	hideTrigger
	submitLabel={w.closeSubmit}
>
	{#snippet fields({ form, errors })}
		<InputComp
			label={w.countedLabel}
			name="countedAmount"
			type="number"
			step="0.01"
			min="0"
			{form}
			{errors}
		/>
		<InputComp
			label={w.bankedLabel}
			name="bankedAmount"
			type="number"
			step="0.01"
			min="0"
			{form}
			{errors}
			description={w.bankedHint}
		/>
		<InputComp
			label={t.m.common.note}
			name="note"
			type="textarea"
			rows={2}
			required={false}
			{form}
			{errors}
			placeholder={w.notePlaceholder}
		/>
	{/snippet}
</FormDialog>
