<script lang="ts">
	import Package from '@lucide/svelte/icons/package';
	import X from '@lucide/svelte/icons/x';
	import type { SuperValidated } from 'sveltekit-superforms';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import { formatETB } from '$lib/global.svelte';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	/**
	 * The bundles a draft can take — those whose services are all on it — and those it has, each with
	 * a button. Applying one re-prices its lines to add up to the bundle's price; taking it off puts
	 * them back (`server/packages.ts`). Shown only on a draft, and only when there is something to do.
	 */
	let {
		applied,
		fitting,
		form
	}: {
		applied: { id: number; name: string; price: number }[];
		fitting: { id: number; name: string; price: number }[];
		form: SuperValidated<Record<string, unknown>>;
	} = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.tab);
</script>

{#if applied.length || fitting.length}
	<div class="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
		<span class="flex items-center gap-2 font-medium"><Package class="size-4" /> {w.bundles}</span>
		{#each fitting as b (b.id)}
			<StepButton
				id="apply-bundle-{b.id}"
				action="?/applyBundle"
				data={form}
				values={{ packageId: b.id }}
				label={w.applyBundle(b.name, formatETB(b.price))}
				icon={Package}
				variant="outline"
			/>
		{/each}
		{#each applied as b (b.id)}
			<StepButton
				id="remove-bundle-{b.id}"
				action="?/removeBundle"
				data={form}
				values={{ packageId: b.id }}
				label={w.removeBundle(b.name)}
				icon={X}
				variant="ghost"
			/>
		{/each}
	</div>
{/if}
