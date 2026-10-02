<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import TallyTable from '../TallyTable.svelte';

	/**
	 * The monthly return on paper, under the facility's letterhead, to sign and hand in. The same
	 * tables as the screen, without the list of what could not be counted — that is for the clinic
	 * to fix, not for the health office to read.
	 */
	let { data } = $props();

	const report = $derived(data.report);
	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
</script>

<svelte:head>
	<title>Monthly Health Report — {report.facility.name}</title>
</svelte:head>

<PrintSheet
	branch={{
		name: report.facility.name,
		address: report.facility.address,
		phone: report.facility.phone
	}}
	fallbackName="Dental clinic"
>
	<section class="flex flex-col gap-1">
		<p class="text-xl font-semibold">Monthly health report (HMIS)</p>
		<p class="text-sm">
			{day(report.period.start)} – {day(report.period.end)} · printed {day(data.printedOn)}
		</p>
	</section>

	<section class="flex flex-col gap-2">
		<p class="font-semibold">Outpatient visits</p>
		<TallyTable
			rows={[
				{ label: 'New', tally: report.visits.new },
				{ label: 'Repeat', tally: report.visits.repeat }
			]}
			labelHeader="Visit"
			withTotal
		/>
	</section>

	<section class="flex break-inside-avoid flex-col gap-2">
		<p class="font-semibold">Diagnoses</p>
		{#if report.cases.length}
			<TallyTable
				rows={report.cases.map((c) => ({ code: c.hmisCode, label: c.name, tally: c.tally }))}
				labelHeader="Diagnosis"
				codeHeader="Code"
				withTotal
			/>
		{:else}
			<p class="text-sm">No coded diagnoses this month.</p>
		{/if}
	</section>

	<section class="mt-8 grid grid-cols-2 gap-8 text-sm">
		<p class="border-t pt-1">Prepared by</p>
		<p class="border-t pt-1">Approved by (name, signature, stamp)</p>
	</section>
</PrintSheet>

<style>
	/* Print only: seventeen columns of figures need the long side of the page. */
	@page {
		size: A4 landscape;
	}
</style>
