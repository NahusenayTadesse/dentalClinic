<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { planTotals } from '$lib/treatmentPlanStatus';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { quoteColumns } from './columns';

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
	const summary = $derived([
		{ label: 'Total', value: formatETB(totals.quoted), strong: true },
		...(decided ? [{ label: 'Agreed', value: formatETB(totals.accepted) }] : [])
	]);
	const day = (value: string | null) => (value ? formatEthiopianDate(new Date(value)) : '—');
</script>

<svelte:head>
	<title>Treatment quote — {data.patient.fullName}</title>
</svelte:head>

<PrintSheet
	branch={{ name: plan.branch, address: plan.branchAddress, phone: plan.branchPhone }}
	fallbackName="Dental clinic"
>
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

	<DataTable variant="print" data={plan.lines} columns={quoteColumns(decided)} {summary} />

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
