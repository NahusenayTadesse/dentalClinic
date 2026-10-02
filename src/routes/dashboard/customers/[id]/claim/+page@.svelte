<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';

	/**
	 * A month's claim to one payer: the bills, their members and authorisations, and the totals. A
	 * download of the same rows goes with it, for a payer that wants a spreadsheet.
	 */
	let { data } = $props();

	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
	const total = $derived(data.bills.reduce((sum, b) => sum + b.total, 0));
	const owed = $derived(data.bills.reduce((sum, b) => sum + b.owed, 0));

	/** One CSV field, quoted, with a leading `= + - @` defused. */
	const field = (value: string | number | null) => {
		const text = String(value ?? '');
		return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
	};
	function download() {
		const rows = [
			['Bill', 'Issued', 'Patient', 'Member no.', 'Pre-authorisation', 'Amount', 'Paid', 'Owed'],
			...data.bills.map((b) => [
				b.invoiceNumber,
				b.issuedOn,
				b.patient,
				b.memberNo,
				b.authorisation,
				b.total,
				b.paid,
				b.owed
			])
		];
		const csv = rows.map((r) => r.map(field).join(',')).join('\r\n');
		const link = document.createElement('a');
		// The byte-order mark is what makes Excel read the Amharic names as UTF-8.
		link.href = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' }));
		link.download = `claim-${data.payer.name}-${data.monthName}_${data.year}.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
	}
</script>

<svelte:head>
	<title>Claim — {data.payer.name}</title>
</svelte:head>

<PrintSheet branch={data.branch} fallbackName="Dental clinic">
	<section class="flex flex-col gap-1">
		<p class="text-xl font-semibold">Claim to {data.payer.name}</p>
		<p class="text-sm">
			{data.monthName}
			{data.year} · {day(data.period.start)} – {day(data.period.end)}
		</p>
		<p class="text-sm">
			{#if data.clinicTin}Our TIN {data.clinicTin} ·{/if} Their TIN {data.payer.tin}
		</p>
		<button
			type="button"
			class="self-start text-sm text-primary underline print:hidden"
			onclick={download}>Download as a spreadsheet</button
		>
	</section>

	{#if data.bills.length}
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr class="border-b text-left">
					<th class="py-1">Bill</th>
					<th class="py-1">Issued</th>
					<th class="py-1">Patient</th>
					<th class="py-1">Member no.</th>
					<th class="py-1">Pre-auth.</th>
					<th class="py-1 text-right">Amount</th>
					<th class="py-1 text-right">Owed</th>
				</tr>
			</thead>
			<tbody>
				{#each data.bills as bill (bill.id)}
					<tr class="border-b">
						<td class="py-1">{bill.invoiceNumber}</td>
						<td class="py-1">{day(bill.issuedOn)}</td>
						<td class="py-1">{bill.patient}</td>
						<td class="py-1">{bill.memberNo ?? '—'}</td>
						<td class="py-1">{bill.authorisation ?? '—'}</td>
						<td class="py-1 text-right tabular-nums">{formatETB(bill.total)}</td>
						<td class="py-1 text-right tabular-nums">{formatETB(bill.owed)}</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr class="font-semibold">
					<td class="py-1" colspan={5}
						>{data.bills.length} {data.bills.length === 1 ? 'bill' : 'bills'}</td
					>
					<td class="py-1 text-right tabular-nums">{formatETB(total)}</td>
					<td class="py-1 text-right tabular-nums">{formatETB(owed)}</td>
				</tr>
			</tfoot>
		</table>
	{:else}
		<p class="text-sm">No bills were issued to this payer in this month.</p>
	{/if}

	<footer class="mt-8 grid grid-cols-2 gap-8 text-sm">
		<p class="border-t pt-2">Prepared by</p>
		<p class="border-t pt-2">For the clinic (signature, stamp)</p>
		<p class="col-span-2 text-xs text-muted-foreground">Printed {day(data.printedOn)}</p>
	</footer>
</PrintSheet>
