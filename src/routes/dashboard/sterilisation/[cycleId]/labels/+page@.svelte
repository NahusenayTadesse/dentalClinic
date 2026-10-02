<script lang="ts">
	import Printer from '@lucide/svelte/icons/printer';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { clinicDate } from '$lib/clinicTime';

	/**
	 * Pack labels: the code large enough to read across a surgery, what is in the pack, and the
	 * two dates that matter at the chair — when it was sterilised and until when it stays sterile.
	 * Three across an A4 sheet, to cut out. No barcode: typing eight characters is quicker than
	 * buying a scanner, and the code reads the same either way.
	 */
	let { data } = $props();

	const day = (iso: string) => formatEthiopianDate(new Date(iso));
	const made = $derived(day(clinicDate(data.cycle.ranAt)));
</script>

<svelte:head>
	<title>Labels — {data.cycle.steriliser} cycle {data.cycle.cycleNo}</title>
</svelte:head>

<main class="mx-auto flex max-w-4xl flex-col gap-4 bg-background p-6 text-foreground print:p-0">
	<div class="flex items-center justify-between print:hidden">
		<p class="text-sm text-muted-foreground">
			{data.packs.length} labels from {data.cycle.steriliser}, cycle {data.cycle.cycleNo}. Cut along
			the lines.
		</p>
		<Button onclick={() => window.print()}><Printer class="size-4" /> Print</Button>
	</div>
	<div class="grid grid-cols-3 border-t border-l border-dashed">
		{#each data.packs as pack (pack.id)}
			<div class="flex break-inside-avoid flex-col gap-0.5 border-r border-b border-dashed p-3">
				<span class="font-mono text-xl font-bold tracking-wide">{pack.code}</span>
				<span class="truncate text-sm">{pack.contents ?? '—'}</span>
				<span class="text-xs">Sterilised {made} · {data.cycle.steriliser}</span>
				<span class="text-xs font-semibold">Use by {day(pack.expiresOn)}</span>
			</div>
		{/each}
	</div>
</main>
