<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';

	/**
	 * A patient's account statement: brought forward, each bill, payment, refund and deposit in the
	 * period with the balance after it, and carried forward — what the patient owes, or (negative)
	 * what they have in credit. The range is chosen above the sheet and not printed.
	 */
	let { data } = $props();

	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
	const money = (n: number) => (n < 0 ? `${formatETB(-n)} in credit` : formatETB(n));
	const s = $derived(data.statement);
</script>

<svelte:head>
	<title>Statement — {data.patient.fullName}</title>
</svelte:head>

<form method="get" class="mx-auto flex max-w-3xl flex-wrap items-end gap-2 px-8 pt-6 print:hidden">
	<label class="flex flex-col gap-1 text-sm">
		From <Input type="date" name="from" value={data.from} class="h-9 w-40" />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		To <Input type="date" name="to" value={data.to} class="h-9 w-40" />
	</label>
	<Button type="submit" variant="outline">Show</Button>
</form>

<PrintSheet branch={data.branch} fallbackName="Dental clinic">
	<section class="flex flex-col gap-1">
		<p class="text-xl font-semibold">Statement of account</p>
		<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
			<dt class="text-muted-foreground">Patient</dt>
			<dd>{data.patient.fullName}{data.patient.fileNo ? ` · File ${data.patient.fileNo}` : ''}</dd>
			<dt class="text-muted-foreground">Period</dt>
			<dd>{day(data.from)} – {day(data.to)}</dd>
		</dl>
	</section>

	<table class="w-full text-sm">
		<thead>
			<tr class="border-b text-left text-xs">
				<th class="py-2 pr-3 font-normal">Date</th>
				<th class="pr-3 font-normal">Reference</th>
				<th class="pr-3 font-normal">Description</th>
				<th class="pr-3 text-right font-normal">Charged</th>
				<th class="pr-3 text-right font-normal">Paid</th>
				<th class="text-right font-normal">Balance</th>
			</tr>
		</thead>
		<tbody>
			<tr class="border-b">
				<td class="py-2 pr-3" colspan="5">Brought forward</td>
				<td class="text-right tabular-nums">{money(s.opening)}</td>
			</tr>
			{#each s.lines as line, i (i)}
				<tr class="break-inside-avoid border-b">
					<td class="py-2 pr-3 whitespace-nowrap">{day(line.date)}</td>
					<td class="pr-3">{line.reference}</td>
					<td class="pr-3">{line.description}</td>
					<td class="pr-3 text-right tabular-nums">{line.debit ? formatETB(line.debit) : ''}</td>
					<td class="pr-3 text-right tabular-nums">{line.credit ? formatETB(line.credit) : ''}</td>
					<td class="text-right tabular-nums">{money(line.balance)}</td>
				</tr>
			{:else}
				<tr><td colspan="6" class="py-3 text-muted-foreground">Nothing in this period.</td></tr>
			{/each}
		</tbody>
		<tfoot>
			<tr>
				<td colspan="3" class="py-2 pr-3 text-right font-semibold">Carried forward</td>
				<td class="pr-3 text-right tabular-nums">{formatETB(s.billed)}</td>
				<td class="pr-3 text-right tabular-nums">{formatETB(s.paid)}</td>
				<td class="text-right font-semibold tabular-nums">{money(s.closing)}</td>
			</tr>
		</tfoot>
	</table>

	<p class="text-sm">
		{#if s.closing > 0}
			Amount due: <strong>{formatETB(s.closing)}</strong>. Please quote your file number when
			paying.
		{:else if s.closing < 0}
			You have <strong>{formatETB(-s.closing)}</strong> in credit, to be used on your next bill.
		{:else}
			Nothing is owed. Thank you.
		{/if}
	</p>
</PrintSheet>
