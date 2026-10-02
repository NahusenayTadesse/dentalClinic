<script lang="ts">
	import type { ReturnRow } from '$lib/controlledDrugs';

	/**
	 * The monthly return as the authority's form lays it out: one line a controlled item, opening
	 * balance to closing. Shared by the screen (where an item's name opens its register) and the
	 * printout (where it does not).
	 */
	let {
		sheet,
		chosen = null,
		href = null
	}: {
		sheet: (ReturnRow & {
			item: { id: number; medicine: string; strength: string | null; unit: string | null };
		})[];
		chosen?: number | null;
		/** Where an item's name leads; none on paper. */
		href?: ((item: number) => string) | null;
	} = $props();
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b text-left text-xs text-muted-foreground">
				<th class="py-2 pr-3 font-normal">Medicine</th>
				<th class="pr-3 text-right font-normal">Opening</th>
				<th class="pr-3 text-right font-normal">Received</th>
				<th class="pr-3 text-right font-normal">Issued</th>
				<th class="pr-3 text-right font-normal">Written off</th>
				<th class="pr-3 text-right font-normal">Adjusted</th>
				<th class="text-right font-normal">Closing</th>
			</tr>
		</thead>
		<tbody>
			{#each sheet as row (row.item.id)}
				<tr class="border-b {row.item.id === chosen ? 'bg-muted/50' : ''}">
					<td class="py-2 pr-3">
						{#if href}
							<a class="underline-offset-2 hover:underline" href={href(row.item.id)}>
								{row.item.medicine}
								{row.item.strength ?? ''}
							</a>
						{:else}
							{row.item.medicine} {row.item.strength ?? ''}
						{/if}
						{#if row.item.unit}<span class="text-muted-foreground"> ({row.item.unit})</span>{/if}
					</td>
					<td class="pr-3 text-right tabular-nums">{row.opening}</td>
					<td class="pr-3 text-right tabular-nums">{row.received}</td>
					<td class="pr-3 text-right tabular-nums">{row.issued}</td>
					<td class="pr-3 text-right tabular-nums">{row.writtenOff}</td>
					<td class="pr-3 text-right tabular-nums">{row.adjusted}</td>
					<td class="text-right font-semibold tabular-nums">{row.closing}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
