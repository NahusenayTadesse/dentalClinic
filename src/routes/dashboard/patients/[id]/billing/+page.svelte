<script lang="ts">
	import StatCard from '@nahu/admin-kit/components/reports/StatCard.svelte';
	import type { Stat } from '@nahu/admin-kit/components/reports/types.js';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Banknote from '@lucide/svelte/icons/banknote';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import ProcedurePicker from '$lib/components/ProcedurePicker.svelte';
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

	const TILES = $derived<Stat[]>([
		{
			key: 'owes',
			label: 'Owes',
			value: data.balance,
			format: 'money',
			group: 'billing',
			tone: data.balance > 0 ? 'negative' : 'neutral'
		},
		{
			key: 'unbilled',
			label: 'Work not yet billed',
			value: data.unbilled.reduce((sum, w) => sum + w.price, 0),
			format: 'money',
			group: 'billing',
			hint: `${data.unbilled.length} piece${data.unbilled.length === 1 ? '' : 's'} of completed work`
		}
	]);
</script>

<svelte:head>
	<title>{data.patient.fullName} — Billing</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<section class="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Account">
		{#each TILES as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
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
