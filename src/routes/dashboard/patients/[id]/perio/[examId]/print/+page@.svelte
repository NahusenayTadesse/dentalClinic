<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { attachmentChanges, changeCounts, perioSummary } from '$lib/perio';
	import PerioGrid from '../PerioGrid.svelte';
	import PerioSummaryLine from '../../PerioSummaryLine.svelte';

	/**
	 * A periodontal exam on paper, under the letterhead of the branch it was taken at: the figures,
	 * the grid read only, and the notes. A draft prints marked as one — a periodontist reading it
	 * should know the readings may not be complete.
	 */
	let { data } = $props();

	const day = (iso: string) => formatEthiopianDate(new Date(iso));
	const summary = $derived(perioSummary(data.teeth));
	const changes = $derived(
		data.previous ? changeCounts(attachmentChanges(data.previous.teeth, data.teeth)) : null
	);
</script>

<svelte:head>
	<title>Periodontal chart — {data.patient.fullName}</title>
</svelte:head>

<PrintSheet
	branch={{
		name: data.exam.branch,
		address: data.exam.branchAddress,
		phone: data.exam.branchPhone
	}}
	fallbackName="Dental clinic"
>
	<section class="flex flex-col gap-1">
		<p class="text-xl font-semibold">
			{data.exam.completedAt ? 'Periodontal chart' : 'Periodontal chart — draft, not finished'}
		</p>
		<dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
			<dt class="text-muted-foreground">Patient</dt>
			<dd>{data.patient.fullName}{data.patient.fileNo ? ` · File ${data.patient.fileNo}` : ''}</dd>
			<dt class="text-muted-foreground">Examined on</dt>
			<dd>{day(data.exam.examinedOn)}</dd>
			{#if data.exam.provider}
				<dt class="text-muted-foreground">Probed by</dt>
				<dd>{data.exam.provider}</dd>
			{/if}
		</dl>
	</section>

	<PerioSummaryLine
		{summary}
		{changes}
		comparedWith={data.previous ? day(data.previous.examinedOn) : null}
	/>

	<PerioGrid teeth={data.teeth} previous={data.previous?.teeth ?? null} readonly />

	{#if data.exam.notes}
		<p class="text-sm whitespace-pre-line"><strong>Notes:</strong> {data.exam.notes}</p>
	{/if}
</PrintSheet>
