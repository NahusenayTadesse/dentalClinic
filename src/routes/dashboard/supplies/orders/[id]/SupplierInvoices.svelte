<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import type { Match } from '$lib/purchasing';
	import { newSupplierInvoice, payInvoice } from '../schema';

	/**
	 * The supplier's invoices for an order, set against the three-way match: ordered, received,
	 * invoiced. An invoice for more than arrived is said so in red before anyone pays it. Each is
	 * paid now, as it is recorded, or later with its own button.
	 */
	let {
		invoices,
		match,
		methods,
		invoiceForm,
		payForm,
		open
	}: {
		invoices: {
			id: number;
			invoiceNo: string;
			invoiceDate: string;
			amount: number;
			note: string | null;
			transactionId: number | null;
			paidWith: string | null;
		}[];
		match: Match;
		methods: { value: string; name: string }[];
		invoiceForm: SuperValidated<Record<string, unknown>>;
		payForm: SuperValidated<Record<string, unknown>>;
		/** Whether invoices can be recorded: the order was sent. */
		open: boolean;
	} = $props();

	let recordOpen = $state(false);
	let payOpen = $state(false);
	let paying = $state<{ invoiceId: number }>({ invoiceId: 0 });
	const notNow = [{ value: '', name: 'Not paid yet' }];
	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
</script>

<div class="flex flex-col gap-4">
	<dl class="grid grid-cols-3 gap-3 text-sm">
		<div class="rounded-md border p-2">
			<dt class="text-xs text-muted-foreground">Ordered</dt>
			<dd class="font-semibold tabular-nums">{formatETB(match.ordered)}</dd>
		</div>
		<div class="rounded-md border p-2">
			<dt class="text-xs text-muted-foreground">Received</dt>
			<dd class="font-semibold tabular-nums">{formatETB(match.received)}</dd>
		</div>
		<div class="rounded-md border p-2 {match.overInvoiced ? 'border-destructive' : ''}">
			<dt class="text-xs text-muted-foreground">Invoiced</dt>
			<dd class="font-semibold tabular-nums {match.overInvoiced ? 'text-destructive' : ''}">
				{formatETB(match.invoiced)}
			</dd>
		</div>
	</dl>
	{#if match.overInvoiced}
		<p role="alert" class="flex items-center gap-2 text-sm text-destructive">
			<TriangleAlert class="size-4 shrink-0" />
			The supplier has invoiced more than has arrived at the order's prices. Receive the rest, or ask
			the supplier, before paying.
		</p>
	{:else if match.unpriced}
		<p class="text-sm text-muted-foreground">
			A line has no price, so the invoice cannot be checked against it.
		</p>
	{/if}

	{#if invoices.length}
		<ul class="flex flex-col divide-y rounded-md border text-sm">
			{#each invoices as inv (inv.id)}
				<li class="flex flex-wrap items-center gap-3 px-3 py-2">
					<span class="font-medium">{inv.invoiceNo}</span>
					<span class="text-muted-foreground">{day(inv.invoiceDate)}</span>
					<span class="tabular-nums">{formatETB(inv.amount)}</span>
					{#if inv.note}<span class="text-muted-foreground">{inv.note}</span>{/if}
					<span class="ml-auto">
						{#if inv.transactionId}
							<span class="text-muted-foreground"
								>Paid{inv.paidWith ? ` · ${inv.paidWith}` : ''}</span
							>
						{:else}
							<Button
								size="sm"
								variant="outline"
								onclick={() => {
									paying = { invoiceId: inv.id };
									payOpen = true;
								}}>Pay</Button
							>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
	{#if open}
		<Button size="sm" variant="outline" class="self-start" onclick={() => (recordOpen = true)}>
			<Plus class="size-4" /> Record the supplier's invoice
		</Button>
	{/if}
</div>

<FormDialog
	title="The supplier's invoice"
	description="As written on it. Choose how it was paid to pay it now, or leave it to pay later."
	action="?/invoice"
	data={invoiceForm}
	schema={newSupplierInvoice}
	bind:open={recordOpen}
	hideTrigger
	resetOnSuccess
	submitLabel="Record"
>
	{#snippet fields({ form, errors })}
		<InputComp label="Their invoice number" name="invoiceNo" {form} {errors} />
		<div class="grid grid-cols-2 gap-3">
			<InputComp label="Dated" name="invoiceDate" type="date" oldDays {form} {errors} />
			<InputComp label="Amount (Br)" name="amount" type="number" {form} {errors} />
		</div>
		<InputComp
			label="Paid with"
			name="paymentMethodId"
			type="select"
			items={[...notNow, ...methods]}
			required={false}
			{form}
			{errors}
		/>
		<InputComp label="Note" name="note" required={false} {form} {errors} />
	{/snippet}
</FormDialog>

<FormDialog
	title="Pay the invoice"
	action="?/pay"
	data={payForm}
	schema={payInvoice}
	bind:open={payOpen}
	seed={paying}
	hideTrigger
	submitLabel="Pay"
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="invoiceId" value={values.invoiceId ?? ''} />
		<InputComp
			label="Paid with"
			name="paymentMethodId"
			type="select"
			items={methods}
			{form}
			{errors}
		/>
	{/snippet}
</FormDialog>
