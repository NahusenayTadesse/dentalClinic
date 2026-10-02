<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Plus from '@lucide/svelte/icons/plus';
	import Printer from '@lucide/svelte/icons/printer';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';

	/**
	 * The plan page's bar of next steps: print, book the agreed work, add work, discard a draft, close
	 * a finished plan. Split from the page when booking pushed it past 500 lines (CLAUDE.md §6). Which
	 * steps show is decided by the page from `$lib/treatmentPlanStatus.ts`; each action re-checks.
	 */
	let {
		base,
		planId,
		patientId,
		draft,
		addable,
		canPlan,
		canBook,
		toBook,
		completable,
		confirm,
		onadd
	}: {
		/** The patient's plans tab. */
		base: string;
		planId: number;
		patientId: number;
		draft: boolean;
		addable: boolean;
		canPlan: boolean;
		canBook: boolean;
		/** Agreed work no live appointment holds yet. */
		toBook: number;
		completable: boolean;
		confirm: SuperValidated<Record<string, unknown>>;
		onadd: () => void;
	} = $props();
</script>

<div class="flex flex-wrap items-center gap-2">
	<Button href={base} variant="ghost" size="sm"><ArrowLeft class="size-4" /> All plans</Button>
	<div class="ml-auto flex flex-wrap gap-2">
		<Button href="{base}/{planId}/quote" target="_blank" variant="outline" size="sm">
			<Printer class="size-4" />
			{draft ? 'Print draft' : 'Print quote'}
		</Button>
		{#if canBook && toBook}
			<!-- The booking reserves the work to the visit (`reservePlanWork`). -->
			<Button size="sm" href="/dashboard/appointments?book={patientId}&plan={planId}">
				<CalendarPlus class="size-4" /> Book the agreed work ({toBook})
			</Button>
		{/if}
		{#if addable}
			<Button size="sm" variant="outline" onclick={onadd}>
				<Plus class="size-4" /> Add work
			</Button>
		{/if}
		{#if canPlan && draft}
			<StepButton
				id="discard-plan"
				action="?/discard"
				data={confirm}
				label="Discard draft"
				icon={Trash}
				variant="ghost"
				confirm={{
					title: 'Discard this draft?',
					description:
						'Nobody has seen it yet, so nothing is lost but the draft. The work stays planned on the chart.',
					action: 'Discard'
				}}
			/>
		{/if}
		{#if canPlan && completable}
			<StepButton
				id="complete-plan"
				action="?/complete"
				data={confirm}
				label="Mark plan completed"
				icon={CircleCheck}
				variant="default"
			/>
		{/if}
	</div>
</div>
