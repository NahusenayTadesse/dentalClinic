<script lang="ts">
	import Ban from '@lucide/svelte/icons/ban';
	import type { SuperValidated } from 'sveltekit-superforms';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';

	/** Cancelling one prescription from its row — a super admin's, for one written in error. */
	let { id, data }: { id: number; data: SuperValidated<Record<string, unknown>> } = $props();
</script>

<StepButton
	id="cancel-rx-{id}"
	action="?/cancel"
	{data}
	label="Cancel"
	icon={Ban}
	variant="ghost"
	values={{ prescriptionId: id }}
	confirm={{
		title: 'Cancel this prescription?',
		description:
			'For one written in error. It leaves the chart and stays on the audit trail. If the patient already has the paper, tell them not to use it.',
		action: 'Cancel it'
	}}
/>
