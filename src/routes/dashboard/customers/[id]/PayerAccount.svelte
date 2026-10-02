<script lang="ts">
	import Banknote from '@lucide/svelte/icons/banknote';
	import Receipt from '@lucide/svelte/icons/receipt';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import PaymentForm from '$lib/components/PaymentForm.svelte';
	import Section from '$lib/components/Section.svelte';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import type { Payment } from '$lib/forms/payment';
	import { formatETB } from '$lib/global.svelte';
	import { payerBillColumns } from './billColumns';
	import type { PageData } from './$types';

	/**
	 * An employer or insurer's account: what they owe across the patients they pay for, their bills,
	 * and taking one payment across several of them — one transfer settling a month of staff visits.
	 * A bill comes here when its "Bill to" is set to this payer before it is issued.
	 */
	let {
		account,
		form
	}: {
		account: NonNullable<PageData['account']>;
		form: SuperValidated<Payment>;
	} = $props();

	let payOpen = $state(false);
</script>

<Section title="Bills" IconComp={Receipt} style="identityIcon" class="lg:col-span-2">
	{#snippet editDialog()}
		<div class="ml-auto flex items-center gap-3">
			<span class="text-sm">
				Owes
				<span class="font-semibold tabular-nums {account.owed > 0 ? 'text-destructive' : ''}">
					{formatETB(account.owed)}
				</span>
			</span>
			<Button size="sm" disabled={!account.payable.length} onclick={() => (payOpen = true)}>
				<Banknote class="size-4" /> Take a payment
			</Button>
		</div>
	{/snippet}
	{#if account.bills.length}
		<DataTable
			columns={payerBillColumns}
			data={account.bills}
			facetKeys={['status']}
			fileName="payer-bills"
			height="auto"
		/>
	{:else}
		<p class="text-sm text-muted-foreground">
			No bills yet. A bill is sent here by choosing this payer under <strong>Bill to</strong> on a draft
			bill — or it happens by itself for a patient whose payer this is.
		</p>
	{/if}
</Section>

<DialogComp title="Take a payment" variant="ghost" bind:open={payOpen}>
	{#snippet trigger()}{/snippet}
	<div class="p-4">
		<PaymentForm
			data={form}
			bills={account.payable}
			methods={account.methods}
			drawerOpen={account.drawerOpen}
			onpaid={() => (payOpen = false)}
		/>
	</div>
</DialogComp>
