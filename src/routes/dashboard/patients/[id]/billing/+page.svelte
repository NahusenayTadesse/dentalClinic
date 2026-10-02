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
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { billColumns } from './columns';
	import { newInvoice } from './schema';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import LookupSection from '@nahu/admin-kit/components/lookup/LookupSection.svelte';
	import { childActionPaths } from '@nahu/admin-kit/components/lookup/actions.js';
	import { authorisationConfig } from './authorisationConfig';
	import { addAuthorisation, editAuthorisation } from './authorisationSchema';

	/**
	 * The billing tab: what the patient owes, the work not yet on a bill, their bills, and taking a
	 * payment across them. A bill is changed, issued and printed on its own page.
	 */
	let { data } = $props();

	let invoiceOpen = $state(false);
	let payOpen = $state(false);
	const t = useI18n();
	const w = $derived(t.m.billing.tab);
	const columns = $derived(billColumns(data.patient.id, t.m));
	const authorisations = $derived(authorisationConfig(t.m));

	const TILES = $derived<Stat[]>([
		{
			key: 'owes',
			label: w.owes,
			value: data.balance,
			format: 'money',
			group: 'billing',
			tone: data.balance > 0 ? 'negative' : 'neutral'
		},
		{
			key: 'unbilled',
			label: w.unbilled,
			value: data.unbilled.reduce((sum, w) => sum + w.price, 0),
			format: 'money',
			group: 'billing',
			hint: w.unbilledHint(data.unbilled.length)
		}
	]);
</script>

<svelte:head>
	<title>{w.pageTitle(data.patient.fullName)}</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<section class="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label={w.account}>
		{#each TILES as stat (stat.key)}
			<StatCard {stat} amharicMoney={false} />
		{/each}
		<div class="flex flex-col justify-center gap-2 rounded-lg border bg-card p-4">
			<Button disabled={!data.unbilled.length} onclick={() => (invoiceOpen = true)}>
				<Plus class="size-4" />
				{w.raiseBill}
			</Button>
			<Button variant="outline" disabled={!data.payable.length} onclick={() => (payOpen = true)}>
				<Banknote class="size-4" />
				{w.takePayment}
			</Button>
		</div>
	</section>

	<Section title={w.bills} IconComp={Receipt} style="identityIcon">
		{#if data.bills.length}
			<DataTable
				{columns}
				data={data.bills}
				facetKeys={['status']}
				fileName="bills"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">{w.noBills}</p>
		{/if}
	</Section>

	<Section title={t.m.billing.authorisations.title} IconComp={ShieldCheck} style="identityIcon">
		<p class="mb-3 text-sm text-muted-foreground">{t.m.billing.authorisations.hint}</p>
		<LookupSection
			config={authorisations}
			rows={data.authorisations.rows}
			addForm={data.authorisations.addForm}
			editForm={data.authorisations.editForm}
			options={{ customerId: data.payers }}
			actions={childActionPaths('Authorisation')}
			schemas={{ add: addAuthorisation, edit: editAuthorisation }}
			canDelete
		/>
	</Section>
</div>

<FormDialog
	title={w.raiseBill}
	description={w.raiseDescription}
	action="?/newInvoice"
	data={data.forms.invoice}
	schema={newInvoice}
	bind:open={invoiceOpen}
	hideTrigger
	submitLabel={w.startBill}
>
	{#snippet fields({ form })}
		<ProcedurePicker {form} work={data.unbilled} legend={w.completedWork}>
			{#snippet empty()}
				{w.nothingToBill}
			{/snippet}
		</ProcedurePicker>
	{/snippet}
</FormDialog>

<DialogComp title={w.takePayment} variant="ghost" bind:open={payOpen}>
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
