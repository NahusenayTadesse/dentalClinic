<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Ban from '@lucide/svelte/icons/ban';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import Printer from '@lucide/svelte/icons/printer';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Send from '@lucide/svelte/icons/send';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { ORDER_STATUS_LABEL, canReceive } from '$lib/purchasing';
	import { receiveLine } from '../schema';
	import DraftLines from './DraftLines.svelte';
	import SupplierInvoices from './SupplierInvoices.svelte';

	/**
	 * One purchase order. A draft is its lines to edit and a Send button; a sent order is its lines
	 * with what has arrived and a Receive button on each; and below, the supplier's invoices set
	 * against what was ordered and received.
	 */
	let { data } = $props();

	const o = $derived(data.order);
	const draft = $derived(o.status === 'draft');
	let receiveOpen = $state(false);
	let receiving = $state<{ lineId: number; quantity: number }>({ lineId: 0, quantity: 0 });
	const line = $derived(data.lines.find((l) => l.id === receiving.lineId));
	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
</script>

<svelte:head>
	<title>{o.number ?? 'Draft order'} — {o.supplier}</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<div class="flex flex-wrap items-center gap-2">
		<Button href="/dashboard/supplies/orders" variant="ghost" size="sm">
			<ArrowLeft class="size-4" /> All orders
		</Button>
		<div class="ml-auto flex flex-wrap gap-2">
			{#if !draft}
				<Button
					href="/dashboard/supplies/orders/{o.id}/print"
					target="_blank"
					variant="outline"
					size="sm"
				>
					<Printer class="size-4" /> Print
				</Button>
			{/if}
			{#if draft}
				<StepButton
					id="send-order"
					action="?/send"
					data={data.forms.step}
					label="Send the order"
					icon={Send}
					variant="default"
					confirm={{
						title: 'Send this order?',
						description:
							'It gets its number, and its lines are fixed. Save the draft first if you changed it.',
						action: 'Send'
					}}
				/>
			{/if}
			{#if o.status === 'draft' || o.status === 'sent'}
				<StepButton
					id="cancel-order"
					action="?/cancel"
					data={data.forms.step}
					label="Cancel"
					icon={Ban}
					variant="ghost"
					confirm={{
						title: 'Cancel this order?',
						description: 'Tell the supplier too, if it was sent.',
						action: 'Cancel the order'
					}}
				/>
			{/if}
		</div>
	</div>

	<header class="flex flex-wrap items-center gap-3">
		<h1 class="text-2xl font-bold">{o.number ?? 'Draft order'}</h1>
		<Badge variant={o.status === 'cancelled' ? 'outline' : 'secondary'}
			>{ORDER_STATUS_LABEL[o.status]}</Badge
		>
		<span class="text-sm text-muted-foreground">
			{o.supplier}{o.orderedOn ? ` · ordered ${day(o.orderedOn)}` : ''}{o.expectedOn
				? ` · expected ${day(o.expectedOn)}`
				: ''}
		</span>
	</header>

	<Section title={draft ? 'What to order' : 'Lines'} IconComp={ShoppingCart} style="identityIcon">
		{#if draft}
			<DraftLines data={data.forms.lines} items={data.items} />
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b text-left text-xs text-muted-foreground">
							<th class="py-2 pr-3 font-normal">Item</th>
							<th class="pr-3 text-right font-normal">Ordered</th>
							<th class="pr-3 text-right font-normal">Received</th>
							<th class="pr-3 text-right font-normal">Unit price</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each data.lines as l (l.id)}
							<tr class="border-b">
								<td class="py-2 pr-3">
									{l.item}{l.unit ? ` (${l.unit})` : ''}
									{#if l.controlled}<Badge variant="outline" class="ml-1">Controlled</Badge>{/if}
								</td>
								<td class="pr-3 text-right tabular-nums">{l.quantity}</td>
								<td
									class="pr-3 text-right tabular-nums {l.received < l.quantity
										? 'text-amber-600 dark:text-amber-400'
										: ''}"
								>
									{l.received}
								</td>
								<td class="pr-3 text-right tabular-nums"
									>{l.unitCost === null ? '—' : formatETB(l.unitCost)}</td
								>
								<td class="text-right">
									{#if canReceive(o.status) && l.received < l.quantity}
										<Button
											size="sm"
											variant="outline"
											onclick={() => {
												receiving = {
													lineId: l.id,
													quantity: Math.round((l.quantity - l.received) * 100) / 100
												};
												receiveOpen = true;
											}}
										>
											<PackageCheck class="size-4" /> Receive
										</Button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if o.note}<p class="mt-3 text-sm text-muted-foreground">{o.note}</p>{/if}
		{/if}
	</Section>

	{#if !draft}
		<Section title="Supplier's invoices" IconComp={Receipt} style="identityIcon">
			<SupplierInvoices
				invoices={data.invoices}
				match={data.match}
				methods={data.methods}
				invoiceForm={data.forms.invoice}
				payForm={data.forms.pay}
				open={o.status !== 'cancelled'}
			/>
		</Section>
	{/if}
</div>

<FormDialog
	title="Receive a delivery"
	description={line
		? `${line.item}: ${Math.round((line.quantity - line.received) * 100) / 100} still to come.`
		: ''}
	action="?/receive"
	data={data.forms.receive}
	schema={receiveLine}
	bind:open={receiveOpen}
	seed={receiving}
	hideTrigger
	resetOnSuccess
	submitLabel="Receive"
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="lineId" value={values.lineId ?? ''} />
		<InputComp label="How many arrived" name="quantity" type="number" {form} {errors} />
		<InputComp
			label="Batch number"
			name="batchNumber"
			required={line?.controlled ?? false}
			placeholder={line?.controlled ? 'Required: a controlled medicine' : 'From the box'}
			{form}
			{errors}
		/>
		{#if line?.tracksExpiry}
			<InputComp label="Expiry date" name="expiryDate" type="date" allowEmpty {form} {errors} />
		{/if}
	{/snippet}
</FormDialog>
