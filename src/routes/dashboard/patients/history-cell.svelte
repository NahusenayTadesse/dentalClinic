<script lang="ts">
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { formatEthiopianDate } from '$lib/global.svelte';

	/**
	 * Whether anyone has asked this patient the medical questions, and how long ago.
	 *
	 * This is what gives the Alerts column its meaning. An empty allergy list under "Current" means
	 * asked and nothing reported; under "Never taken" it means nobody asked — and the two must not
	 * look alike to a dentist about to give an injection.
	 */
	let { state, takenAt }: { state: string; takenAt: string | null } = $props();
</script>

{#if state === 'never'}
	<Badge variant="destructive">Never taken</Badge>
{:else if state === 'stale'}
	<Badge class="bg-amber-500 text-white">
		{takenAt ? formatEthiopianDate(new Date(takenAt)) : 'Over a year old'}
	</Badge>
{:else}
	<Badge variant="secondary">{takenAt ? formatEthiopianDate(new Date(takenAt)) : 'Current'}</Badge>
{/if}
