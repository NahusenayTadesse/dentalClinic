<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatETB } from '$lib/global.svelte';

	/**
	 * Services from the catalogue as a checklist, bound to a form's `serviceIds`, each with its
	 * standard fee.
	 *
	 * Two uses, which is why it is a component (CLAUDE.md §2): completing a visit ticks the services
	 * its type usually involves, and Appointment Types chooses which those are. Charted work — a
	 * procedure with a tooth — is `ProcedurePicker`'s, not this.
	 */
	type Store = ComponentProps<typeof InputComp>['form'];

	let {
		form,
		services,
		legend,
		disabled = false
	}: {
		form: Store;
		/** A service with no standard fee has `price` null, and shows none rather than "ETB 0.00". */
		services: { serviceId: number; name: string; price: number | null }[];
		legend: string;
		disabled?: boolean;
	} = $props();
</script>

<fieldset class="flex flex-col gap-1" {disabled}>
	<legend class="mb-1 text-xs text-muted-foreground uppercase">{legend}</legend>
	{#each services as s (s.serviceId)}
		<label class="flex items-center gap-2 text-sm">
			<input
				type="checkbox"
				name="serviceIds"
				value={s.serviceId}
				bind:group={$form.serviceIds}
				class="size-4 accent-primary"
			/>
			{s.name}
			{#if s.price !== null}<span class="text-muted-foreground">{formatETB(s.price)}</span>{/if}
		</label>
	{/each}
</fieldset>
