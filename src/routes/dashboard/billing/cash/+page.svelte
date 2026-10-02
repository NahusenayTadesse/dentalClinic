<script lang="ts">
	import History from '@lucide/svelte/icons/history';
	import Vault from '@lucide/svelte/icons/vault';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { formatETB } from '$lib/global.svelte';
	import { ethiopianDateTime } from '$lib/tableCells';
	import { columns } from './columns';
	import { closeDrawerForm, openDrawerForm } from './schema';

	/**
	 * The cash drawer at this branch. Open it with the float; through the day it says what it should
	 * hold; count it and close it at night. A count that is off asks why before it will close.
	 */
	let { data } = $props();

	let openOpen = $state(false);
	let closeOpen = $state(false);
</script>

<svelte:head>
	<title>Cash drawer</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">Cash drawer</h1>
		<p class="text-muted-foreground">Cash payments at this branch go into the open drawer.</p>
	</header>

	<Section title={data.open ? 'Open' : 'Closed'} IconComp={Vault} style="identityIcon">
		{#if !data.branchChosen}
			<p class="text-sm text-muted-foreground">
				Choose the branch you are working at, in the top bar, to see its drawer.
			</p>
		{:else if data.open}
			<dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
				<div>
					<dt class="text-muted-foreground">Opened</dt>
					<dd>{ethiopianDateTime(data.open.openedAt)} · {data.open.openedBy ?? '—'}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Float</dt>
					<dd class="tabular-nums">{formatETB(data.open.openingFloat)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Cash taken</dt>
					<dd class="tabular-nums">
						{formatETB(data.open.cashIn)} · {data.open.payments} payment{data.open.payments === 1
							? ''
							: 's'}
					</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Should hold</dt>
					<dd class="text-lg font-semibold tabular-nums">{formatETB(data.open.expected)}</dd>
				</div>
			</dl>
			<div class="mt-4 flex justify-end">
				<Button onclick={() => (closeOpen = true)}>Count and close</Button>
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">
				The drawer is closed, so cash cannot be taken at this branch. Open it with what is in it.
			</p>
			<div class="mt-4 flex justify-end">
				<Button onclick={() => (openOpen = true)}>Open the drawer</Button>
			</div>
		{/if}
	</Section>

	<Section title="Recent counts" IconComp={History} style="systemIcon">
		{#if data.closed.length}
			<DataTable {columns} data={data.closed} fileName="cash-counts" height="auto" />
		{:else}
			<p class="text-sm text-muted-foreground">No drawer has been counted at this branch yet.</p>
		{/if}
	</Section>
</div>

<FormDialog
	title="Open the drawer"
	action="?/open"
	data={data.forms.open}
	schema={openDrawerForm}
	bind:open={openOpen}
	hideTrigger
	submitLabel="Open"
>
	{#snippet fields({ form, errors })}
		<InputComp
			label="Float (birr)"
			name="openingFloat"
			type="number"
			step="0.01"
			min="0"
			{form}
			{errors}
			description="What is in the drawer before the first patient pays — usually what was left in it last night."
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title="Count and close"
	description="Count the cash in the drawer and type the total. It is compared with what the drawer should hold ({formatETB(
		data.open?.expected ?? 0
	)})."
	action="?/close"
	data={data.forms.close}
	schema={closeDrawerForm}
	bind:open={closeOpen}
	hideTrigger
	submitLabel="Close the drawer"
>
	{#snippet fields({ form, errors })}
		<InputComp
			label="Counted (birr)"
			name="countedAmount"
			type="number"
			step="0.01"
			min="0"
			{form}
			{errors}
		/>
		<InputComp
			label="Taken out to bank (birr)"
			name="bankedAmount"
			type="number"
			step="0.01"
			min="0"
			{form}
			{errors}
			description="What leaves the drawer tonight. The rest stays as tomorrow's float."
		/>
		<InputComp
			label="Note"
			name="note"
			type="textarea"
			rows={2}
			required={false}
			{form}
			{errors}
			placeholder="Required if the count is off: what you know about why"
		/>
	{/snippet}
</FormDialog>
