<script lang="ts">
	import { HMIS_BAND_KEYS, bandLabel, emptyTally, tallyTotals, type Tally } from '$lib/hmisReport';

	/**
	 * Rows of people by age group and sex, laid out as the health office's form is: a pair of male
	 * and female columns under each age group, then the totals.
	 *
	 * A plain table rather than `data-table.svelte`: the return is a fixed form with a two-row header,
	 * read and printed whole, and nothing in it is sorted, searched or paged. Shared by the screen and
	 * the printed sheet so they cannot disagree about a column.
	 */
	let {
		rows,
		labelHeader,
		codeHeader = null,
		withTotal = false
	}: {
		rows: { code?: string; label: string; tally: Tally }[];
		labelHeader: string;
		/** Shown as a first column when the rows carry a code — the Ministry's, for diagnoses. */
		codeHeader?: string | null;
		/** Adds a row summing the others. */
		withTotal?: boolean;
	} = $props();

	const total = $derived.by(() => {
		const sum = emptyTally();
		for (const row of rows) {
			for (const key of HMIS_BAND_KEYS) {
				sum[key].male += row.tally[key].male;
				sum[key].female += row.tally[key].female;
			}
		}
		return sum;
	});

	const shown = $derived(
		withTotal ? [...rows, { code: '', label: 'Total', tally: total, isTotal: true }] : rows
	);
</script>

<div class="overflow-x-auto rounded-md border print:overflow-visible">
	<table class="w-full border-collapse text-sm tabular-nums print:text-[10px]">
		<thead class="bg-muted/50">
			<tr>
				{#if codeHeader}<th rowspan="2" class="border-b px-2 py-1 text-left">{codeHeader}</th>{/if}
				<th rowspan="2" class="border-b px-2 py-1 text-left">{labelHeader}</th>
				{#each HMIS_BAND_KEYS as key (key)}
					<th colspan="2" class="border-b border-l px-2 py-1 text-center">{bandLabel(key)}</th>
				{/each}
				<th colspan="3" class="border-b border-l px-2 py-1 text-center">Total</th>
			</tr>
			<tr class="text-xs text-muted-foreground">
				{#each HMIS_BAND_KEYS as key (key)}
					<th class="border-b border-l px-2 py-1 text-right">M</th>
					<th class="border-b px-2 py-1 text-right">F</th>
				{/each}
				<th class="border-b border-l px-2 py-1 text-right">M</th>
				<th class="border-b px-2 py-1 text-right">F</th>
				<th class="border-b px-2 py-1 text-right">All</th>
			</tr>
		</thead>
		<tbody>
			{#each shown as row, i (i)}
				{@const sums = tallyTotals(row.tally)}
				<tr class={'isTotal' in row ? 'bg-muted/50 font-semibold' : 'border-b last:border-b-0'}>
					{#if codeHeader}<td class="px-2 py-1 font-mono">{row.code ?? ''}</td>{/if}
					<td class="px-2 py-1">{row.label}</td>
					{#each HMIS_BAND_KEYS as key (key)}
						<td class="border-l px-2 py-1 text-right">{row.tally[key].male || ''}</td>
						<td class="px-2 py-1 text-right">{row.tally[key].female || ''}</td>
					{/each}
					<td class="border-l px-2 py-1 text-right">{sums.male}</td>
					<td class="px-2 py-1 text-right">{sums.female}</td>
					<td class="px-2 py-1 text-right font-semibold">{sums.all}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
