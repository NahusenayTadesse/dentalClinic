<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { formatETB } from '$lib/global.svelte';
	import type { Stat } from '../../../routes/dashboard/reports/types';

	let { stat, onselect }: { stat: Stat; onselect?: (section: string) => void } = $props();

	const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
	const DECIMAL = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

	const display = $derived.by(() => {
		switch (stat.format) {
			case 'money':
				return formatETB(stat.value, true);
			case 'percent':
				return `${DECIMAL.format(stat.value)}%`;
			case 'years':
				return `${DECIMAL.format(stat.value)} yr`;
			case 'hours':
				return `${DECIMAL.format(stat.value)} h`;
			case 'days':
				return `${NUMBER.format(stat.value)} d`;
			default:
				return NUMBER.format(stat.value);
		}
	});

	/** The accent stripe: what the number means, not whether it went up. */
	const accent = $derived(
		{
			positive: 'border-l-emerald-500',
			negative: 'border-l-rose-500',
			warning: 'border-l-amber-500',
			neutral: 'border-l-sky-500'
		}[stat.tone ?? 'neutral']
	);

	const clickable = $derived(Boolean(stat.section && onselect));
</script>

<Card
	class="{accent} border-l-4 transition-shadow hover:shadow-md {clickable ? 'cursor-pointer' : ''}"
	role={clickable ? 'button' : undefined}
	tabindex={clickable ? 0 : undefined}
	onclick={() => clickable && onselect?.(stat.section as string)}
	onkeydown={(event: KeyboardEvent) => {
		if (!clickable) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onselect?.(stat.section as string);
		}
	}}
>
	<CardContent class="p-4">
		<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{stat.label}</p>
		<p class="mt-1 text-2xl font-semibold break-words tabular-nums">{display}</p>
		{#if stat.hint}
			<p class="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
		{/if}
	</CardContent>
</Card>
