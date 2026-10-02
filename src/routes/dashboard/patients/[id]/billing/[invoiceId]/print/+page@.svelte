<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { lineColumns, paymentColumns } from './columns';

	/**
	 * A bill on paper: its lines as issued, what has been paid with each receipt number, and what is
	 * still owed. Every figure is the bill's own, so reprinting it next year prints the same bill.
	 */
	let { data } = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.print);
	const lines = $derived(lineColumns(t.m));
	const paidColumns = $derived(paymentColumns(t.m));

	const bill = $derived(data.bill);
	/** Under the lines: the subtotal, the discount and VAT where there are any, and the total. */
	const taxed = $derived(bill.vatAmount !== null && bill.vatRate !== null);
	const summary = $derived([
		...(bill.discount || taxed ? [{ label: w.subtotal, value: formatETB(bill.subtotal) }] : []),
		...(bill.discount ? [{ label: w.discount, value: `−${formatETB(bill.discount)}` }] : []),
		...(taxed && bill.vatRate !== null && bill.vatAmount !== null
			? [{ label: w.vat(bill.vatRate), value: formatETB(bill.vatAmount) }]
			: []),
		{ label: w.total, value: formatETB(bill.total), strong: true }
	]);
	const day = (value: string | null) => (value ? formatEthiopianDate(new Date(value)) : '—');
</script>

<svelte:head>
	<title>{bill.invoiceNumber} — {data.patient.fullName}</title>
</svelte:head>

<PrintSheet branch={data.branch} fallbackName={w.fallbackName}>
	<section class="flex flex-col gap-1">
		<p class="text-xl font-semibold">
			{bill.status === 'void' ? w.billVoid : w.bill}
			{bill.invoiceNumber}
		</p>
		{#if data.clinicTin}<p class="text-sm">{w.clinicTin(data.clinicTin)}</p>{/if}
		<dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
			<dt class="text-muted-foreground">{w.patient}</dt>
			<dd>
				{data.patient.fullName}{data.patient.fileNo ? ` · ${w.file(data.patient.fileNo)}` : ''}
			</dd>
			{#if data.payer}
				<dt class="text-muted-foreground">{w.billTo}</dt>
				<dd>{data.payer}</dd>
				{#if data.payerTin}
					<dt class="text-muted-foreground">{w.payerTin}</dt>
					<dd>{data.payerTin}</dd>
				{/if}
			{/if}
			<dt class="text-muted-foreground">{w.issued}</dt>
			<dd>{day(bill.issuedOn)}</dd>
			{#if bill.dueOn}
				<dt class="text-muted-foreground">{w.due}</dt>
				<dd>{day(bill.dueOn)}</dd>
			{/if}
		</dl>
	</section>

	<DataTable variant="print" data={bill.lines} columns={lines} {summary} />

	{#if bill.payments.length}
		<DataTable variant="print" data={bill.payments} columns={paidColumns} />
	{/if}

	<p class="text-right text-lg font-semibold">
		{bill.owed > 0 ? w.stillOwed(formatETB(bill.owed)) : bill.status === 'void' ? '' : w.paidInFull}
	</p>

	<footer class="mt-8 flex flex-col gap-6 text-sm text-muted-foreground">
		<p>{taxed && bill.vatRate !== null ? w.vatCharged(bill.vatRate) : w.vatExempt}</p>
		<div class="grid grid-cols-2 gap-8 pt-8">
			<p class="border-t pt-2">{w.receivedBy}</p>
			<p class="border-t pt-2">{w.forTheClinic}</p>
		</div>
		<p class="text-xs">{w.printed(day(data.printedOn))}</p>
	</footer>
</PrintSheet>
