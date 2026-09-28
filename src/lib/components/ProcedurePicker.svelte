<script lang="ts">
	import type { ComponentProps, Snippet } from 'svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { formatETB } from '$lib/global.svelte';

	/**
	 * Charted work as a checklist, bound to a form's `procedureIds` — what a treatment plan quotes
	 * and what a bill is raised from, with the running total of what is ticked.
	 *
	 * The list is whatever the caller offers (planned work not on an open plan; completed work not
	 * yet billed); the server checks it again, since it can be stale by the time it is posted. A
	 * refusal shows in the dialog's error summary. Began as the plans' own picker; billing was its
	 * second use (CLAUDE.md §2).
	 */
	type Store = ComponentProps<typeof InputComp>['form'];

	let {
		form,
		work,
		legend,
		empty
	}: {
		form: Store;
		/** `detail` is a second line of context — the visit a piece of work was done at. */
		work: { id: number; service: string | null; where: string; price: number; detail?: string }[];
		legend: string;
		/** What to say when there is nothing to choose — which says where the work comes from. */
		empty: Snippet;
	} = $props();

	const total = $derived(
		work
			.filter((w) => ($form.procedureIds ?? []).includes(w.id))
			.reduce((sum, w) => sum + w.price, 0)
	);
</script>

<fieldset class="flex flex-col gap-2">
	<legend class="mb-2 text-sm font-medium">{legend}</legend>
	{#if work.length}
		<ul class="flex max-h-80 flex-col divide-y overflow-y-auto rounded-md border">
			{#each work as item (item.id)}
				<li>
					<label class="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted">
						<input
							type="checkbox"
							name="procedureIds"
							value={item.id}
							bind:group={$form.procedureIds}
							class="size-4 accent-primary"
						/>
						<span class="flex-1">
							{item.service ?? 'Retired service'}
							<span class="text-muted-foreground">· {item.where}</span>
							{#if item.detail}
								<span class="block text-xs text-muted-foreground">{item.detail}</span>
							{/if}
						</span>
						<span class="tabular-nums">{formatETB(item.price)}</span>
					</label>
				</li>
			{/each}
		</ul>
		<p class="text-right text-sm">
			Selected: <span class="font-semibold tabular-nums">{formatETB(total)}</span>
		</p>
	{:else}
		<p class="text-sm text-muted-foreground">{@render empty()}</p>
	{/if}
</fieldset>
