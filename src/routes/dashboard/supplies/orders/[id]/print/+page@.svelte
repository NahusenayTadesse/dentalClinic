<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';

	/**
	 * A purchase order for the supplier: who orders from whom, what, how many and at what price,
	 * and when it is wanted. The number is what the supplier quotes on the invoice.
	 */
	let { data } = $props();

	const o = $derived(data.order);
	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
</script>

<svelte:head>
	<title>{o.number} — {o.supplier}</title>
</svelte:head>

<PrintSheet branch={data.branch} fallbackName="Dental clinic">
	<section class="flex flex-col gap-2">
		<p class="text-xl font-semibold">Purchase order {o.number}</p>
		<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
			<dt class="text-muted-foreground">To</dt>
			<dd>{o.supplier}{o.supplierPhone ? ` · ${o.supplierPhone}` : ''}</dd>
			{#if o.orderedOn}
				<dt class="text-muted-foreground">Ordered on</dt>
				<dd>{day(o.orderedOn)}</dd>
			{/if}
			{#if o.expectedOn}
				<dt class="text-muted-foreground">Wanted by</dt>
				<dd>{day(o.expectedOn)}</dd>
			{/if}
		</dl>
	</section>

	<table class="w-full text-sm">
		<thead>
			<tr class="border-b text-left text-xs">
				<th class="py-2 pr-3 font-normal">Item</th>
				<th class="pr-3 text-right font-normal">Quantity</th>
				<th class="pr-3 text-right font-normal">Unit price</th>
				<th class="text-right font-normal">Amount</th>
			</tr>
		</thead>
		<tbody>
			{#each data.lines as l (l.id)}
				<tr class="border-b">
					<td class="py-2 pr-3">{l.item}{l.unit ? ` (${l.unit})` : ''}</td>
					<td class="pr-3 text-right tabular-nums">{l.quantity}</td>
					<td class="pr-3 text-right tabular-nums"
						>{l.unitCost === null ? '—' : formatETB(l.unitCost)}</td
					>
					<td class="text-right tabular-nums"
						>{l.unitCost === null ? '—' : formatETB(l.quantity * l.unitCost)}</td
					>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr>
				<td colspan="3" class="py-2 pr-3 text-right">Total</td>
				<td class="text-right font-semibold tabular-nums">{formatETB(data.match.ordered)}</td>
			</tr>
		</tfoot>
	</table>

	{#if o.note}<p class="text-sm">{o.note}</p>{/if}
	<p class="text-sm">Please quote {o.number} on your invoice and delivery note.</p>

	<section class="mt-6 grid grid-cols-2 gap-x-10 text-sm">
		{#each ['Ordered by: name and signature', 'Stamp'] as label (label)}
			<div class="flex flex-col gap-1">
				<div class="h-10 border-b border-foreground/60"></div>
				<span class="text-xs text-muted-foreground">{label}</span>
			</div>
		{/each}
	</section>
</PrintSheet>
