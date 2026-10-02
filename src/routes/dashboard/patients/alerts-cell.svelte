<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';

	/**
	 * What a clinician must know before touching the patient, in one cell.
	 *
	 * Ordered by how much it changes treatment: a severe allergy, then a medicine that changes
	 * what a dentist may do (bleeding, bone, immunity), then any other allergy. An empty cell says
	 * "nothing recorded", which is not the same as "nothing wrong" — the History column is what
	 * says whether anyone asked.
	 */
	let {
		allergies,
		medicineAlerts
	}: {
		allergies: { name: string; severity: string }[];
		medicineAlerts: string[];
	} = $props();

	const severe = $derived(allergies.filter((a) => a.severity === 'severe'));
	const other = $derived(allergies.filter((a) => a.severity !== 'severe'));
</script>

<div class="flex max-w-72 flex-wrap gap-1">
	{#each severe as allergy (allergy.name)}
		<Badge variant="destructive" class="gap-1">
			<TriangleAlert class="size-3" />
			{allergy.name}
		</Badge>
	{/each}
	{#each medicineAlerts as alert (alert)}
		<Badge class="bg-amber-500 text-white">{alert}</Badge>
	{/each}
	{#each other as allergy (allergy.name)}
		<Badge variant="outline" class="border-red-400 text-red-700 dark:text-red-300">
			{allergy.name}
		</Badge>
	{/each}
</div>
