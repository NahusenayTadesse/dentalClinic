<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { PLAN_STATUS_LABEL, type PlanStatus } from '$lib/treatmentPlanStatus';

	/**
	 * A treatment plan's status, the same on the patient's plans, a plan's own page, the follow-up
	 * list and the printed quote.
	 *
	 * Colour only where it asks for something (CLAUDE.md §7): a quote awaiting an answer is amber,
	 * because somebody should ring; work agreed is the primary colour; everything finished or lost
	 * is outlined. A decline is not an error, so it is not red.
	 */
	let { status }: { status: PlanStatus } = $props();

	const tone: Partial<Record<PlanStatus, string>> = {
		presented: 'bg-amber-500 text-white',
		accepted: 'bg-primary text-primary-foreground',
		partial: 'bg-primary/20 text-foreground',
		completed: 'bg-secondary text-secondary-foreground'
	};
</script>

<Badge variant={tone[status] ? 'default' : 'outline'} class={tone[status] ?? ''}>
	{PLAN_STATUS_LABEL[status]}
</Badge>
