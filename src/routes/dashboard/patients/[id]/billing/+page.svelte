<script lang="ts">
	import Receipt from '@lucide/svelte/icons/receipt';
	import Banknote from '@lucide/svelte/icons/banknote';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '$lib/components/Section.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import FormDialog from '$lib/formComponents/FormDialog.svelte';
	import ProcedurePicker from '$lib/components/ProcedurePicker.svelte';
	import { formatETB } from '$lib/global.svelte';
	import PaymentForm from '$lib/components/PaymentForm.svelte';
	import { billColumns } from './columns';
	import { newInvoice } from './schema';

	/**
	 * The billing tab: what the patient owes, the work not yet on a bill, their bills, and taking a
	 * payment across them. A bill is changed, issued and printed on its own page.
	 */
	let { data } = $props();

	let invoiceOpen = $state(false);
	let payOpen = $state(false);
	const columns = $derived(billColumns(data.patient.id));
</script>

<svelte:head>
	<title>{data.patient.fullName} — Billing</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<section class="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Account">
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Owes</p>
			<p class="text-2xl font-bold tabular-nums {data.balance > 0 ? 'text-destructive' : ''}">
				{formatETB(data.balance)}
			</p>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<p class="text-sm text-muted-foreground">Work not yet billed</p>
			<p class="text-2xl font-bold tabular-nums">
				{formatETB(data.unbilled.reduce((sum, w) => sum + w.price, 0))}
			</p>
			<p class="text-xs text-muted-foreground">
				{data.unbilled.length} piece{data.unbilled.length === 1 ? '' : 's'} of completed work
			</p>
		</div>
		<div class="flex flex-col justify-center gap-2 rounded-lg border bg-card p-4">
			<Button disabled={!data.unbilled.length} onclick={() => (invoiceOpen = true)}>
				<Plus class="size-4" /> Raise a bill
			</Button>
			<Button variant="outline" disabled={!data.payable.length} onclick={() => (payOpen = true)}>
				<Banknote class="size-4" /> Take a payment
			</Button>
		</div>
	</section>

	<Section title="Bills" IconComp={Receipt} style="identityIcon">
		{#if data.bills.length}
			<DataTable
				{columns}
				data={data.bills}
				facetKeys={['status']}
				fileName="bills"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">
				No bills yet. A bill is raised from completed work — mark treatment done on the dental
				chart, or complete the visit in the diary.
			</p>
		{/if}
	</Section>
</div>

<FormDialog
	title="Raise a bill"
	description="Choose the completed work to bill. It starts as a draft: add other charges or a discount, then issue it."
	action="?/newInvoice"
	data={data.forms.invoice}
	schema={newInvoice}
	bind:open={invoiceOpen}
	hideTrigger
	submitLabel="Start the bill"
>
	{#snippet fields({ form })}
		<ProcedurePicker {form} work={data.unbilled} legend="Completed work">
			{#snippet empty()}
				Nothing completed is waiting to be billed.
			{/snippet}
		</ProcedurePicker>
	{/snippet}
</FormDialog>

<DialogComp title="Take a payment" variant="ghost" bind:open={payOpen}>
	{#snippet trigger()}{/snippet}
	<div class="p-4">
		<PaymentForm
			data={data.forms.payment}
			bills={data.payable}
			methods={data.methods}
			drawerOpen={data.drawerOpen}
			onpaid={() => (payOpen = false)}
		/>
	</div>
</DialogComp>
