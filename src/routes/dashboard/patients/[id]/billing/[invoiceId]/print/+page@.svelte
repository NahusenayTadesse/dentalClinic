<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { lineColumns, paymentColumns } from './columns';

	/**
	 * A bill on paper: its lines as issued, what has been paid with each receipt number, and what is
	 * still owed. Every figure is the bill's own, so reprinting it next year prints the same bill.
	 */
	let { data } = $props();

	const bill = $derived(data.bill);
	/** Under the lines: the subtotal and discount when there is one, and the total. */
	const summary = $derived([
		...(bill.discount
			? [
					{ label: 'Subtotal', value: formatETB(bill.subtotal) },
					{ label: 'Discount', value: `−${formatETB(bill.discount)}` }
				]
			: []),
		{ label: 'Total', value: formatETB(bill.total), strong: true }
	]);
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

	<DataTable variant="print" data={bill.lines} columns={lineColumns} {summary} />

	{#if bill.payments.length}
		<DataTable variant="print" data={bill.payments} columns={paymentColumns} />
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
