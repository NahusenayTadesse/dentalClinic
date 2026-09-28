<script lang="ts">
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { planTotals } from '$lib/treatmentPlanStatus';

	/**
	 * A treatment quote on paper, for the patient to take home.
	 *
	 * On `PrintSheet`, under the letterhead of the branch the plan was drawn up at. Every figure is
	 * the plan's own snapshot, so reprinting next year gives the same quote.
	 *
	 * A draft prints marked as one: it has not been presented, and a patient holding it should know
	 * the prices are not yet a quote. A quote changed since it was presented says so, with what it
	 * first came to — the patient may still be holding the first copy.
	 */
	let { data } = $props();

	const plan = $derived(data.plan);
	const totals = $derived(planTotals(plan.lines));
	const decided = $derived(plan.decidedOn !== null);
	const day = (value: string | null) => (value ? formatEthiopianDate(new Date(value)) : '—');
</script>

<svelte:head>
	<title>Treatment quote — {data.patient.fullName}</title>
</svelte:head>

<PrintSheet branch={{ name: plan.branch, address: plan.branchAddress, phone: plan.branchPhone }}>
	<section class="flex flex-col gap-1">
		<p class="text-xl font-semibold">
			{plan.status === 'draft' ? 'Treatment plan — draft, not yet a quote' : 'Treatment quote'}
		</p>
		<dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
			<dt class="text-muted-foreground">Patient</dt>
			<dd>{data.patient.fullName}{data.patient.fileNo ? ` · File ${data.patient.fileNo}` : ''}</dd>
			{#if plan.provider}
				<dt class="text-muted-foreground">Proposed by</dt>
				<dd>{plan.provider}</dd>
			{/if}
			<dt class="text-muted-foreground">Quoted on</dt>
			<dd>{day(plan.presentedOn)}</dd>
			<dt class="text-muted-foreground">Prices stand until</dt>
			<dd>{day(plan.validUntil)}</dd>
			{#if data.revision}
				<dt class="text-muted-foreground">Revised</dt>
				<dd>
					{formatEthiopianDate(new Date(data.revision.lastOn))} — this replaces the quote first given,
					which came to {formatETB(data.revision.originalTotal)}
				</dd>
			{/if}
		</dl>
	</section>

	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-b text-left">
				<th class="py-2">Treatment</th>
				<th class="py-2 text-right">Qty</th>
				<th class="py-2 text-right">Price</th>
				<th class="py-2 text-right">Total</th>
				{#if decided}<th class="py-2 pl-4">Agreed</th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each plan.lines as line (line.id)}
				<tr class="break-inside-avoid border-b">
					<td class="py-2">{line.description}</td>
					<td class="py-2 text-right tabular-nums">{line.quantity}</td>
					<td class="py-2 text-right tabular-nums">{formatETB(line.unitPrice)}</td>
					<td class="py-2 text-right tabular-nums">{formatETB(line.lineTotal)}</td>
					{#if decided}
						<td class="py-2 pl-4">{line.decision === 'accepted' ? 'Yes' : 'No'}</td>
					{/if}
				</tr>
			{/each}
		</tbody>
		<tfoot>
			<tr class="font-semibold">
				<td class="py-2" colspan="3">Total</td>
				<td class="py-2 text-right tabular-nums">{formatETB(totals.quoted)}</td>
				{#if decided}<td></td>{/if}
			</tr>
			{#if decided}
				<tr>
					<td class="py-1" colspan="3">Agreed</td>
					<td class="py-1 text-right tabular-nums">{formatETB(totals.accepted)}</td>
					<td></td>
				</tr>
			{/if}
		</tfoot>
	</table>

	<footer class="mt-8 flex flex-col gap-6 text-sm text-muted-foreground">
		<p>
			This is an estimate of the treatment discussed. Prices stand until the date above; after it,
			ask for a new quote. Treatment found to be needed once work has begun is discussed with you
			before it is done.
		</p>
		<div class="grid grid-cols-2 gap-8 pt-8">
			<p class="border-t pt-2">Patient’s signature</p>
			<p class="border-t pt-2">For the clinic</p>
		</div>
		<p class="text-xs">Printed {day(data.printedOn)}</p>
	</footer>
</PrintSheet>
