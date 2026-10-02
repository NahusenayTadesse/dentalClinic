<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { Label } from '@nahu/admin-kit/components/ui/label/index.js';
	import { SURFACE_NAMES, SURFACE_ORDER, surfacesOf } from '$lib/teeth';

	/**
	 * The surfaces of one tooth, as toggles, writing the letters a dentist writes ("MOD") into the
	 * form's `surfaces` field.
	 *
	 * Offers only the surfaces the chosen tooth has — no occlusal on an incisor — so the mistake the
	 * server refuses is hard to make in the first place. The server still checks: this is a picker,
	 * not the rule.
	 */
	let {
		form,
		tooth,
		error
	}: {
		/** The form store, as `InputComp` takes it. */
		form: ComponentProps<typeof InputComp>['form'];
		tooth: number | null;
		error?: string[];
	} = $props();

	const available = $derived(tooth ? surfacesOf(tooth) : []);

	function toggle(letter: string) {
		form.update((f) => {
			const current = typeof f.surfaces === 'string' ? f.surfaces : '';
			const next = current.includes(letter) ? current.replace(letter, '') : current + letter;
			// Kept in written order as it is built, so what is shown is what will be saved.
			return { ...f, surfaces: SURFACE_ORDER.filter((s) => next.includes(s)).join('') };
		});
	}
</script>

<div class="flex flex-col gap-2">
	<Label>Surfaces</Label>
	{#if tooth}
		<div class="flex flex-wrap gap-2" role="group" aria-label="Surfaces of tooth {tooth}">
			{#each available as letter (letter)}
				{@const on = String($form.surfaces ?? '').includes(letter)}
				<button
					type="button"
					aria-pressed={on}
					title={SURFACE_NAMES[letter]}
					onclick={() => toggle(letter)}
					class="flex size-10 items-center justify-center rounded-md border text-sm font-semibold {on
						? 'border-primary bg-primary text-primary-foreground'
						: 'hover:bg-accent'}"
				>
					{letter}
				</button>
			{/each}
		</div>
		<p class="text-xs text-muted-foreground">
			{available.map((l) => `${l} ${SURFACE_NAMES[l].toLowerCase()}`).join(' · ')}
		</p>
	{:else}
		<p class="text-sm text-muted-foreground">Choose the tooth first.</p>
	{/if}
	{#if error?.length}
		<p class="text-sm text-destructive">{error[0]}</p>
	{/if}
	<input type="hidden" name="surfaces" value={$form.surfaces ?? ''} />
</div>
