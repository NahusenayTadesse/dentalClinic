<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import Ban from '@lucide/svelte/icons/ban';
	import PackageCheck from '@lucide/svelte/icons/package-check';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Send from '@lucide/svelte/icons/send';
	import Smile from '@lucide/svelte/icons/smile';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import {
		LAB_STATUS_LABEL,
		NEXT_LAB_STATUS,
		isLabCaseStatus,
		type LabCaseStatus
	} from '$lib/labCaseStatus';

	/**
	 * The buttons that move one lab case on, drawn from `NEXT_LAB_STATUS` — the table the server
	 * checks — so a row never offers a move the action refuses. Shared by the lab board and the
	 * patient's Lab work tab, which post to their own `?/move`.
	 *
	 * Sending and sending back take the laboratory's usual turnaround as the due date. A case whose
	 * lab promised a different day is opened from the chart's form, where the date is asked for.
	 */
	let {
		id,
		status,
		data
	}: { id: number; status: string; data: SuperValidated<Record<string, unknown>> } = $props();

	const ICONS = {
		sent: Send,
		received: PackageCheck,
		fitted: Smile,
		remake: RotateCcw,
		cancelled: Ban
	} as const;

	/** The two moves that cannot be taken back ask first. */
	const CONFIRM: Partial<
		Record<LabCaseStatus, { title: string; description: string; action: string }>
	> = {
		remake: {
			title: 'Send it back for a remake?',
			description:
				'The case goes back to the laboratory and is counted as a remake against it. It is due back after the lab’s usual turnaround.',
			action: 'Send it back'
		},
		cancelled: {
			title: 'Cancel this case?',
			description:
				'For work that will not be made after all. It stays on the patient’s record as cancelled.',
			action: 'Cancel it'
		}
	};

	const moves = $derived(isLabCaseStatus(status) ? NEXT_LAB_STATUS[status] : []);
</script>

<div class="flex flex-wrap justify-end gap-1">
	{#each moves as to (to)}
		<!-- Nothing moves back to a draft; the check narrows `to` for the icon. -->
		{#if to !== 'draft'}
			<StepButton
				id="lab-{id}-{to}"
				action="?/move"
				{data}
				label={LAB_STATUS_LABEL[to].action}
				icon={ICONS[to]}
				variant={to === 'cancelled' ? 'ghost' : 'outline'}
				values={{ caseId: id, to }}
				confirm={CONFIRM[to]}
			/>
		{/if}
	{/each}
</div>
