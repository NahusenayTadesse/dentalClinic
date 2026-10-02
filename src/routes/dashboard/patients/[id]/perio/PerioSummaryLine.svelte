<script lang="ts">
	import { DEEP, VERY_DEEP, WORSE_BY, type PerioSummary } from '$lib/perio';

	/**
	 * What an exam adds up to, in the figures a periodontist reads first: how many teeth, how many
	 * deep pockets, how much bleeding and plaque, and what changed since the exam before. Shared by
	 * the tab (for the latest exam) and an exam's own page (worked out as it is typed).
	 */
	let {
		summary,
		changes = null,
		comparedWith = null
	}: {
		summary: PerioSummary;
		changes?: { worse: number; better: number } | null;
		/** The earlier exam's date, as the screen writes dates. */
		comparedWith?: string | null;
	} = $props();

	const pct = (n: number | null) => (n === null ? '—' : `${n}%`);
</script>

<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
	<div class="rounded-md border p-2">
		<dt class="text-xs text-muted-foreground">Teeth present</dt>
		<dd class="text-lg font-semibold tabular-nums">{summary.teethPresent}</dd>
	</div>
	<div class="rounded-md border p-2">
		<dt class="text-xs text-muted-foreground">Sites measured</dt>
		<dd class="text-lg font-semibold tabular-nums">{summary.sitesMeasured}</dd>
	</div>
	<div class="rounded-md border p-2">
		<dt class="text-xs text-muted-foreground">Pockets {DEEP}+ mm</dt>
		<dd class="text-lg font-semibold tabular-nums">{summary.deep}</dd>
	</div>
	<div class="rounded-md border p-2 {summary.veryDeep ? 'border-destructive' : ''}">
		<dt class="text-xs text-muted-foreground">Pockets {VERY_DEEP}+ mm</dt>
		<dd class="text-lg font-semibold tabular-nums {summary.veryDeep ? 'text-destructive' : ''}">
			{summary.veryDeep}
		</dd>
	</div>
	<div class="rounded-md border p-2">
		<dt class="text-xs text-muted-foreground">Bleeding on probing</dt>
		<dd class="text-lg font-semibold tabular-nums">{pct(summary.bleedingPercent)}</dd>
	</div>
	<div class="rounded-md border p-2">
		<dt class="text-xs text-muted-foreground">Plaque</dt>
		<dd class="text-lg font-semibold tabular-nums">{pct(summary.plaquePercent)}</dd>
	</div>
	<div class="rounded-md border p-2 {changes?.worse ? 'border-destructive' : ''}">
		<dt class="text-xs text-muted-foreground">
			{comparedWith ? `Since ${comparedWith}` : 'Since the last exam'}
		</dt>
		<dd class="text-sm font-semibold">
			{#if changes}
				<span class={changes.worse ? 'text-destructive' : ''}>{changes.worse} worse</span>
				· {changes.better} better
				<span class="block text-xs font-normal text-muted-foreground">by {WORSE_BY}+ mm</span>
			{:else}
				<span class="font-normal text-muted-foreground">No earlier exam</span>
			{/if}
		</dd>
	</div>
</dl>
