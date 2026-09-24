<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { licenceState } from './licence';

	/**
	 * A provider's licence, as the one thing a manager actually reads on this screen: whether it is
	 * still valid. An expiry that has passed is destructive-coloured, one inside the warning window
	 * is amber, and a licence with no date says so rather than looking fine.
	 */
	let { expiresOn }: { expiresOn: string | Date | null | undefined } = $props();

	const state = $derived(licenceState(expiresOn));
</script>

{#if state.kind === 'none'}
	<span class="text-muted-foreground">No expiry recorded</span>
{:else if state.kind === 'expired'}
	<Badge variant="destructive">Expired {formatEthiopianDate(new Date(state.on))}</Badge>
{:else if state.kind === 'expiring'}
	<Badge class="bg-amber-500 text-white">
		{state.days} days left · {formatEthiopianDate(new Date(state.on))}
	</Badge>
{:else}
	<span>{formatEthiopianDate(new Date(state.on))}</span>
{/if}
