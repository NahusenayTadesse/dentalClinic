<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import { config } from './lookup';
	import { add, edit } from './schema';
	import { LICENCE_WARNING_DAYS, licenceState } from './licence';

	let { data } = $props();

	/*
	 * The line a manager comes here for. Counted on screen rather than in the load: the rows are
	 * already here, and a clinic has tens of providers, not thousands.
	 */
	const licences = $derived(
		data.rows.map((row) => licenceState(row.licenceExpiresOn as string | Date | null))
	);
	const expired = $derived(licences.filter((l) => l.kind === 'expired').length);
	const expiring = $derived(licences.filter((l) => l.kind === 'expiring').length);
	const missing = $derived(licences.filter((l) => l.kind === 'none').length);
</script>

{#if expired || expiring || missing}
	<p
		class="mt-4 flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"
		class:border-destructive={expired > 0}
	>
		<TriangleAlert class="size-4 {expired ? 'text-destructive' : 'text-muted-foreground'}" />
		{#if expired}<span class="font-medium text-destructive"
				>{expired} licence{expired === 1 ? '' : 's'} expired.</span
			>{/if}
		{#if expiring}<span>{expiring} expiring within {LICENCE_WARNING_DAYS} days.</span>{/if}
		{#if missing}<span class="text-muted-foreground">{missing} with no expiry recorded.</span>{/if}
	</p>
{/if}

<LookupPage {data} {config} schemas={{ add, edit }} />
