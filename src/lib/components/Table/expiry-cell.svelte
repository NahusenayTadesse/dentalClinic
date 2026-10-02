<script lang="ts">
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { expiryState } from '$lib/expiry';

	/**
	 * An expiry date as the one thing a reader wants from it: whether it is still good. A date that
	 * has passed is destructive-coloured, one inside the warning window is amber, and no date says
	 * so rather than looking fine. Used for provider licences and stock lots.
	 */
	let {
		expiresOn,
		warningDays,
		noneText = 'No expiry recorded'
	}: {
		expiresOn: string | Date | null | undefined;
		/** How many days ahead counts as expiring soon. */
		warningDays: number;
		/** What to say when there is no date. */
		noneText?: string;
	} = $props();

	const state = $derived(expiryState(expiresOn, warningDays));
</script>

{#if state.kind === 'none'}
	<span class="text-muted-foreground">{noneText}</span>
{:else if state.kind === 'expired'}
	<Badge variant="destructive">Expired {formatEthiopianDate(new Date(state.on))}</Badge>
{:else if state.kind === 'expiring'}
	<Badge class="bg-amber-500 text-white">
		{state.days} days left · {formatEthiopianDate(new Date(state.on))}
	</Badge>
{:else}
	<span>{formatEthiopianDate(new Date(state.on))}</span>
{/if}
