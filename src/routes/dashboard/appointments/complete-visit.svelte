<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '$lib/forms/createForm';
	import { completeVisit, type CompleteVisit } from '$lib/forms/appointmentSchemas';
	import { formatETB } from '$lib/global.svelte';
	import type { DayAppointment } from './types';

	/**
	 * Finishing a visit: ticking what was done, then completing it — one submit, one transaction
	 * (`completeVisit` in `server/appointmentActions.ts`).
	 *
	 * Planned work already linked to this visit starts ticked, and so do the whole-mouth services the
	 * visit's type usually involves; other planned work is offered unticked, since most of a plan is
	 * done at later visits. Work on a tooth that was never planned is charted on the dental chart,
	 * where the tooth is chosen — this panel does not guess one.
	 *
	 * Without clinical access the work is listed but cannot be ticked, and the visit completes alone.
	 */
	let {
		appointment,
		data,
		canChart,
		ondone
	}: {
		appointment: DayAppointment;
		data: SuperValidated<CompleteVisit>;
		canChart: boolean;
		ondone: () => void;
	} = $props();

	/*
	 * Read once: the dialog is keyed by appointment, so each visit gets a panel of its own and there
	 * is no later value to follow.
	 */
	// svelte-ignore state_referenced_locally
	const [a, initial, chart] = [appointment, data, canChart];
	const planned = a.work?.planned ?? [];
	const usual = a.work?.usual ?? [];

	const { form, enhance, delayed, allErrors } = createForm(initial, completeVisit, {
		// One per visit, so a reply for this visit is never delivered to another's panel.
		id: `complete-visit-${a.id}`,
		onUpdated({ form }) {
			if (form.message?.type === 'success') ondone();
		}
	});

	$form.id = a.id;
	$form.procedureIds = chart
		? planned.filter((p) => p.appointmentId === a.id).map((p) => p.id)
		: [];
	$form.serviceIds = chart ? usual.map((u) => u.serviceId) : [];

	/** Where planned work is: a span, a tooth and its surfaces, or the whole mouth. */
	const where = (p: (typeof planned)[number]) =>
		p.toothRange
			? p.toothRange.replaceAll(',', ', ')
			: p.toothId === null
				? 'whole mouth'
				: `${p.toothId}${p.surfaces ? ` ${p.surfaces}` : ''}`;
</script>

<form
	method="post"
	action="?/completeVisit"
	use:enhance
	id="complete-{a.id}"
	class="flex flex-col gap-3 rounded-md border p-3"
>
	<Errors allErrors={$allErrors} />
	<input type="hidden" name="id" value={a.id} />

	<p class="text-sm font-semibold">Work done at this visit</p>

	{#if planned.length || usual.length}
		{#if !canChart}
			<p class="text-sm text-muted-foreground">
				Recording the work needs clinical access. The visit can still be completed; the dentist
				charts the work.
			</p>
		{/if}

		{#if usual.length}
			<fieldset class="flex flex-col gap-1" disabled={!canChart}>
				<legend class="mb-1 text-xs text-muted-foreground uppercase">
					Usual for {a.type ?? 'this visit'}
				</legend>
				{#each usual as u (u.serviceId)}
					<label class="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							name="serviceIds"
							value={u.serviceId}
							bind:group={$form.serviceIds}
							class="size-4 accent-primary"
						/>
						{u.name}
						{#if u.price !== null}<span class="text-muted-foreground">{formatETB(u.price)}</span
							>{/if}
					</label>
				{/each}
			</fieldset>
		{/if}

		{#if planned.length}
			<fieldset class="flex flex-col gap-1" disabled={!canChart}>
				<legend class="mb-1 text-xs text-muted-foreground uppercase"
					>Planned for this patient</legend
				>
				{#each planned as p (p.id)}
					<label class="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							name="procedureIds"
							value={p.id}
							bind:group={$form.procedureIds}
							class="size-4 accent-primary"
						/>
						{p.service ?? 'Retired service'}
						<span class="text-muted-foreground">{where(p)}</span>
						{#if p.fee !== null}<span class="ml-auto text-muted-foreground">{formatETB(p.fee)}</span
							>{/if}
					</label>
				{/each}
			</fieldset>
		{/if}
	{:else}
		<p class="text-sm text-muted-foreground">
			Nothing is planned for this patient. Work done on a tooth is charted on the dental chart.
		</p>
	{/if}

	<Button type="submit" size="sm" form="complete-{a.id}" disabled={$delayed}>
		{#if $delayed}<LoadingBtn name="Completing" />{:else}<CheckCheck class="size-4" /> Complete visit{/if}
	</Button>
</form>
