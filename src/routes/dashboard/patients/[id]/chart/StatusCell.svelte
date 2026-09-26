<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { PROCEDURE_STATUS_LABEL, isProcedureStatus } from '$lib/procedureStatus';

	/**
	 * A procedure's status in the table, in the odontogram's colours: red for a finding, a primary
	 * tint for planned work, solid for work done, outlined for everything no longer in play. The same
	 * status reads the same way in the picture and in the list.
	 */
	let { status }: { status: string } = $props();

	const tone: Record<string, string> = {
		condition: 'bg-destructive text-white',
		planned: 'bg-primary/20 text-foreground',
		completed: 'bg-primary text-primary-foreground',
		existing: 'bg-secondary text-secondary-foreground'
	};
</script>

<Badge variant={tone[status] ? 'default' : 'outline'} class={tone[status] ?? ''}>
	{isProcedureStatus(status) ? PROCEDURE_STATUS_LABEL[status].label : status}
</Badge>
