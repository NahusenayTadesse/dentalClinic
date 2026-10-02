<script lang="ts">
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { DAY_LABEL, type DayKind } from '$lib/attendance';

	/**
	 * A day's status as a badge, the same on the register and the month grid. Colour means
	 * something (CLAUDE.md §7): an absence is the one thing in red, presence the primary colour,
	 * every reason not to be here muted. `short` draws the grid's one-letter cell.
	 */
	let { kind, short = false }: { kind: DayKind; short?: boolean } = $props();

	const tone: Record<DayKind, string> = {
		present: 'border-transparent bg-primary/15 text-primary',
		absent: 'border-transparent bg-destructive text-destructive-foreground',
		excused: 'border-transparent bg-muted text-foreground',
		leave: 'border-transparent bg-muted text-foreground',
		closed: 'border-transparent bg-muted text-muted-foreground',
		notYet: 'text-muted-foreground',
		off: 'border-transparent text-muted-foreground',
		unjudged: 'border-transparent text-muted-foreground'
	};
</script>

{#if short}
	<span
		class="inline-flex size-6 items-center justify-center rounded text-xs font-semibold {tone[
			kind
		]}"
		title={DAY_LABEL[kind].label}
	>
		{DAY_LABEL[kind].short}
	</span>
{:else}
	<Badge variant="outline" class={tone[kind]}>{DAY_LABEL[kind].label}</Badge>
{/if}
