<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { CHART_ROWS, isAnterior, type Dentition, type ToothState } from '$lib/teeth';

	/**
	 * The patient's mouth as a dentist draws it: upper arch above, lower below, the patient's right
	 * on the viewer's left, each tooth a five-surface diagram coloured by what is on it.
	 *
	 * **Surfaces land where they are in the mouth.** Buccal is always toward the outside of the
	 * arch (the top of an upper tooth, the bottom of a lower one) and mesial always toward the
	 * midline, so "MO" on 16 and "MO" on 26 fill mirrored cells, as they would on paper.
	 *
	 * **Colour means something** (CLAUDE.md §7): red is a finding still untreated, a primary tint is
	 * planned work, solid primary is work done. A tooth whose work has no surfaces — a crown, a root
	 * canal — shows it on its outline instead. A missing tooth is crossed out.
	 *
	 * Draws only; it does not fetch or decide anything. Choosing a tooth calls `onselect`.
	 */
	let {
		dentition,
		states,
		selected = null,
		onselect
	}: {
		dentition: Dentition;
		states: Map<number, ToothState>;
		selected?: number | null;
		onselect: (tooth: number) => void;
	} = $props();

	const sets = $derived(
		dentition === 'mixed'
			? [CHART_ROWS.primary, CHART_ROWS.permanent]
			: [dentition === 'primary' ? CHART_ROWS.primary : CHART_ROWS.permanent]
	);

	/** The patient's right half of the chart: quadrants 1, 4, 5 and 8. Their midline is to the right. */
	const onViewersLeft = (tooth: number) => [1, 4, 5, 8].includes(Math.floor(tooth / 10));
	const isUpper = (tooth: number) => [1, 2, 5, 6].includes(Math.floor(tooth / 10));

	/** The letter in each cell of a tooth's 3×3 diagram; corners are blank. */
	function cells(tooth: number): (string | null)[] {
		const outer = 'B';
		const inner = 'L';
		const [top, bottom] = isUpper(tooth) ? [outer, inner] : [inner, outer];
		const [left, right] = onViewersLeft(tooth) ? ['D', 'M'] : ['M', 'D'];
		const centre = isAnterior(tooth) ? 'I' : 'O';
		return [null, top, null, left, centre, right, null, bottom, null];
	}

	function cellClass(state: ToothState | undefined, letter: string | null): string {
		if (!letter) return '';
		if (!state || state.missing) return 'bg-muted';
		if (state.surfaces.condition.includes(letter)) return 'bg-destructive';
		if (state.surfaces.planned.includes(letter)) return 'bg-primary/35';
		if (state.surfaces.done.includes(letter)) return 'bg-primary';
		return 'bg-muted';
	}

	/**
	 * Whole-tooth work, on the outline: a finding or planned work with no surfaces (a fracture, an
	 * extraction to do), or done work with none (a crown, a root canal).
	 */
	function outlineClass(state: ToothState | undefined): string {
		if (!state || state.missing) return 'border-border';
		if (state.condition && !state.surfaces.condition) return 'border-destructive border-2';
		if (state.planned && !state.surfaces.planned) return 'border-primary border-2 border-dashed';
		if (state.done && !state.surfaces.done) return 'border-primary border-2';
		return 'border-border';
	}

	function describe(tooth: number, state: ToothState | undefined): string {
		if (!state) return `Tooth ${tooth}: nothing charted`;
		const parts = [
			state.missing && 'missing',
			state.condition && `finding${state.surfaces.condition ? ` ${state.surfaces.condition}` : ''}`,
			state.planned && `planned${state.surfaces.planned ? ` ${state.surfaces.planned}` : ''}`,
			state.done && `done${state.surfaces.done ? ` ${state.surfaces.done}` : ''}`
		].filter(Boolean);
		return `Tooth ${tooth}: ${parts.join(', ')}`;
	}
</script>

{#snippet toothButton(tooth: number)}
	{@const state = states.get(tooth)}
	{@const upper = isUpper(tooth)}
	<button
		type="button"
		onclick={() => onselect(tooth)}
		aria-pressed={selected === tooth}
		aria-label={describe(tooth, state)}
		title={describe(tooth, state)}
		class="flex flex-col items-center gap-1 rounded-md p-0.5 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none {selected ===
		tooth
			? 'bg-accent ring-2 ring-ring'
			: ''}"
	>
		{#if upper}<span class="text-xs text-muted-foreground tabular-nums">{tooth}</span>{/if}
		<span
			class="relative grid size-6 grid-cols-3 grid-rows-3 gap-px overflow-hidden rounded-sm border @xl:size-7 @2xl:size-8 @3xl:size-9 {outlineClass(
				state
			)} {state?.missing ? 'opacity-40' : ''}"
		>
			{#each cells(tooth) as letter, i (i)}
				<span class={cellClass(state, letter)}></span>
			{/each}
			{#if state?.missing}
				<X class="absolute inset-0 m-auto size-full text-foreground" strokeWidth={1.5} />
			{/if}
		</span>
		{#if !upper}<span class="text-xs text-muted-foreground tabular-nums">{tooth}</span>{/if}
	</button>
{/snippet}

<!-- Equal halves, so the midline is centred whether the row has eight teeth or a child's five. -->
{#snippet arch(halves: readonly (readonly number[])[])}
	<div class="flex w-full">
		<div class="flex flex-1 justify-end border-r border-dashed pr-1">
			{#each halves[0] as tooth (tooth)}{@render toothButton(tooth)}{/each}
		</div>
		<div class="flex flex-1 pl-1">
			{#each halves[1] as tooth (tooth)}{@render toothButton(tooth)}{/each}
		</div>
	</div>
{/snippet}

<!--
	Centred with `mx-auto w-max`, not `justify-center`: a centred flex row wider than its box
	overflows on both sides, and the half past the left edge cannot be scrolled to. That clipped
	17, 18, 47 and 48 off every chart narrower than the full arch.

	Teeth are sized by the chart's own width (`@container`), not the window's: the sidebar and the
	tooth panel take a varying share of the screen, so the viewport says nothing about the room the
	sixteen teeth actually have. The scrollbar is left for a phone.
-->
<div class="@container overflow-x-auto pb-2">
	<div class="mx-auto flex w-max flex-col gap-2" role="group" aria-label="Dental chart">
		{#each sets as set, i (i)}
			{@render arch(set.upper)}
		{/each}
		<div class="border-t border-dashed"></div>
		{#each [...sets].reverse() as set, i (i)}
			{@render arch(set.lower)}
		{/each}
	</div>
</div>

<ul class="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
	<li class="flex items-center gap-1.5">
		<span class="size-3 rounded-sm bg-destructive"></span> Finding
	</li>
	<li class="flex items-center gap-1.5">
		<span class="size-3 rounded-sm bg-primary/35"></span> Planned
	</li>
	<li class="flex items-center gap-1.5"><span class="size-3 rounded-sm bg-primary"></span> Done</li>
	<li class="flex items-center gap-1.5">
		<span class="size-3 rounded-sm border-2 border-dashed border-primary"></span> Whole tooth
	</li>
	<li class="flex items-center gap-1.5"><X class="size-3" /> Missing</li>
</ul>
