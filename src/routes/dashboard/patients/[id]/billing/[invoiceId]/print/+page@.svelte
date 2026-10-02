<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';

	/**
	 * A bill on paper: its lines as issued, what has been paid with each receipt number, and what is
	 * still owed. Every figure is the bill's own, so reprinting it next year prints the same bill.
	 */
	let { data } = $props();

	const bill = $derived(data.bill);
	const day = (value: string | null) => (value ? formatEthiopianDate(new Date(value)) : '—');
</script>

<svelte:head>
	<title>{bill.invoiceNumber} — {data.patient.fullName}</title>
</svelte:head>

<PrintSheet branch={data.branch} fallbackName="Dental clinic">
	<section class="flex flex-col gap-1">
		<p class="text-xl font-semibold">
			{bill.status === 'void' ? 'Bill — VOID' : 'Bill'}
			{bill.invoiceNumber}
		</p>
		<dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
			<dt class="text-muted-foreground">Patient</dt>
			<dd>{data.patient.fullName}{data.patient.fileNo ? ` · File ${data.patient.fileNo}` : ''}</dd>
			{#if data.payer}
				<dt class="text-muted-foreground">Bill to</dt>
				<dd>{data.payer}</dd>
			{/if}
			<dt class="text-muted-foreground">Issued</dt>
			<dd>{day(bill.issuedOn)}</dd>
			{#if bill.dueOn}
				<dt class="text-muted-foreground">Due</dt>
				<dd>{day(bill.dueOn)}</dd>
			{/if}
		</dl>
	</section>

	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-b text-left">
				<th class="py-2">What</th>
				<th class="py-2 text-right">Qty</th>
				<th class="py-2 text-right">Price</th>
				<th class="py-2 text-right">Total</th>
			</tr>
		</thead>
		<tbody>
			{#each bill.lines as line (line.id)}
				<tr class="break-inside-avoid border-b">
					<td class="py-2">{line.description}</td>
					<td class="py-2 text-right tabular-nums">{line.quantity}</td>
					<td class="py-2 text-right tabular-nums">{formatETB(line.unitPrice)}</td>
					<td class="py-2 text-right tabular-nums">{formatETB(line.lineTotal)}</td>
				</tr>
			{/each}
		</tbody>
		<tfoot>
			{#if bill.discount}
				<tr>
					<td class="py-1" colspan="3">Subtotal</td>
					<td class="py-1 text-right tabular-nums">{formatETB(bill.subtotal)}</td>
				</tr>
				<tr>
					<td class="py-1" colspan="3">Discount</td>
					<td class="py-1 text-right tabular-nums">−{formatETB(bill.discount)}</td>
				</tr>
			{/if}
			<tr class="font-semibold">
				<td class="py-2" colspan="3">Total</td>
				<td class="py-2 text-right tabular-nums">{formatETB(bill.total)}</td>
			</tr>
		</tfoot>
	</table>

	{#if bill.payments.length}
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr class="border-b text-left">
					<th class="py-2">Paid</th>
					<th class="py-2">Receipt</th>
					<th class="py-2">How</th>
					<th class="py-2 text-right">Amount</th>
				</tr>
			</thead>
			<tbody>
				{#each bill.payments as paid (paid.id)}
					<tr class="border-b">
						<td class="py-2">{day(paid.occurredOn)}</td>
						<td class="py-2">
							{paid.receiptNumber ?? '—'}{paid.direction === 'out' ? ' (refund)' : ''}
						</td>
						<td class="py-2">{paid.method ?? '—'}</td>
						<td class="py-2 text-right tabular-nums">{formatETB(paid.amount)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<p class="text-right text-lg font-semibold">
		{bill.owed > 0
			? `Still owed: ${formatETB(bill.owed)}`
			: bill.status === 'void'
				? ''
				: 'Paid in full'}
	</p>

	<footer class="mt-8 flex flex-col gap-6 text-sm text-muted-foreground">
		<p>Medical services are exempt from VAT.</p>
		<div class="grid grid-cols-2 gap-8 pt-8">
			<p class="border-t pt-2">Received by</p>
			<p class="border-t pt-2">For the clinic</p>
		</div>
		<p class="text-xs">Printed {day(data.printedOn)}</p>
	</footer>
</PrintSheet>
