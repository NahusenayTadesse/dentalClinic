<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { ethiopianDateTime } from '$lib/tableCells';
	import { MOVEMENT_LABEL } from '$lib/controlledDrugs';
	import ControlledReturn from '../ControlledReturn.svelte';

	/**
	 * The month's return for the Food and Drug Authority, and the chosen item's register beneath it,
	 * with lines for the pharmacist and the head of the clinic to sign.
	 */
	let { data } = $props();

	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
	const r = $derived(data.register);
</script>

<svelte:head>
	<title>Controlled medicines — {data.month}</title>
</svelte:head>

<PrintSheet branch={data.branch} fallbackName="Dental clinic">
	<section class="flex flex-col gap-1">
		<p class="text-xl font-semibold">Controlled medicines — monthly return</p>
		<p class="text-sm text-muted-foreground">{day(data.period.start)} – {day(data.period.end)}</p>
	</section>

	<ControlledReturn sheet={data.sheet} />

	{#if data.chosen && r}
		<section class="flex break-before-page flex-col gap-2">
			<p class="font-semibold">Register: {data.chosen.medicine} {data.chosen.strength ?? ''}</p>
			<table class="w-full text-xs">
				<thead>
					<tr class="border-b text-left">
						<th class="py-1 pr-2 font-normal">When</th>
						<th class="pr-2 font-normal">Movement</th>
						<th class="pr-2 font-normal">Batch</th>
						<th class="pr-2 font-normal">From / to</th>
						<th class="pr-2 text-right font-normal">In</th>
						<th class="pr-2 text-right font-normal">Out</th>
						<th class="text-right font-normal">Balance</th>
					</tr>
				</thead>
				<tbody>
					<tr class="border-b">
						<td class="py-1" colspan="6">Brought forward</td>
						<td class="text-right">{r.summary.opening}</td>
					</tr>
					{#each r.lines as line (line.id)}
						<tr class="break-inside-avoid border-b">
							<td class="py-1 pr-2">{ethiopianDateTime(line.at)}</td>
							<td class="pr-2">{MOVEMENT_LABEL[line.movement]}</td>
							<td class="pr-2">{line.batchNumber ?? '—'}</td>
							<td class="pr-2">
								{line.patient
									? `${line.patient}${line.fileNo ? ` · ${line.fileNo}` : ''}`
									: (line.supplier ?? line.reason ?? '—')}
							</td>
							<td class="pr-2 text-right">{line.quantity > 0 ? line.quantity : ''}</td>
							<td class="pr-2 text-right">{line.quantity < 0 ? -line.quantity : ''}</td>
							<td class="text-right">{line.balance}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}

	<section class="mt-6 grid break-inside-avoid grid-cols-2 gap-x-10 gap-y-8 text-sm">
		{#each ['Pharmacist: name and signature', 'Head of the clinic: name and signature', 'Date', 'Stamp'] as label (label)}
			<div class="flex flex-col gap-1">
				<div class="h-10 border-b border-foreground/60"></div>
				<span class="text-xs text-muted-foreground">{label}</span>
			</div>
		{/each}
	</section>
</PrintSheet>
