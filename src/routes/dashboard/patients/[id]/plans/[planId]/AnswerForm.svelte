<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Save from '@lucide/svelte/icons/save';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { formatETB } from '$lib/global.svelte';
	import { outcomeOf, PLAN_STATUS_LABEL } from '$lib/treatmentPlanStatus';
	import { answer } from '../schema';

	/**
	 * Recording what the patient said: yes or no to each line, and why when any of it was a no.
	 *
	 * Posted as JSON — a decision per line is a list, which form fields do not carry. The outcome
	 * shown before saving is `outcomeOf`, the same rule the server applies, so what the screen says
	 * the plan will become is what it becomes.
	 */
	let {
		data,
		lines
	}: {
		data: SuperValidated<Infer<typeof answer>>;
		lines: { id: number; description: string; lineTotal: number }[];
	} = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data, answer, {
		dataType: 'json',
		resetForm: false
	});

	function decide(itemId: number, decision: 'accepted' | 'declined') {
		form.update((f) => ({
			...f,
			decisions: f.decisions.map((d) => (d.itemId === itemId ? { ...d, decision } : d))
		}));
	}

	function decideAll(decision: 'accepted' | 'declined') {
		form.update((f) => ({ ...f, decisions: f.decisions.map((d) => ({ ...d, decision })) }));
	}

	const decisionOf = (itemId: number) =>
		$form.decisions.find((d) => d.itemId === itemId)?.decision ?? 'pending';

	const outcome = $derived(outcomeOf($form.decisions.map((d) => d.decision)));
	const agreed = $derived(
		lines.filter((l) => decisionOf(l.id) === 'accepted').reduce((sum, l) => sum + l.lineTotal, 0)
	);
</script>

<form method="post" action="?/answer" use:enhance class="flex flex-col gap-4">
	<Errors allErrors={$allErrors} />

	<div class="flex flex-wrap gap-2">
		<Button type="button" size="sm" variant="outline" onclick={() => decideAll('accepted')}>
			<Check class="size-4" /> Yes to all
		</Button>
		<Button type="button" size="sm" variant="outline" onclick={() => decideAll('declined')}>
			<X class="size-4" /> No to all
		</Button>
	</div>

	<ul class="flex flex-col divide-y rounded-md border">
		{#each lines as line (line.id)}
			{@const decision = decisionOf(line.id)}
			<li class="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
				<span class="flex-1">{line.description}</span>
				<span class="tabular-nums">{formatETB(line.lineTotal)}</span>
				<div class="flex gap-1" role="group" aria-label="Answer for {line.description}">
					<Button
						type="button"
						size="sm"
						variant={decision === 'accepted' ? 'default' : 'outline'}
						aria-pressed={decision === 'accepted'}
						onclick={() => decide(line.id, 'accepted')}
					>
						Yes
					</Button>
					<Button
						type="button"
						size="sm"
						variant={decision === 'declined' ? 'secondary' : 'outline'}
						aria-pressed={decision === 'declined'}
						onclick={() => decide(line.id, 'declined')}
					>
						No
					</Button>
				</div>
			</li>
		{/each}
	</ul>

	{#if outcome && outcome !== 'accepted'}
		<InputComp
			label="Why not?"
			name="declineReason"
			type="textarea"
			rows={2}
			{form}
			{errors}
			required
			placeholder="“After the harvest”, “wants a second opinion”, “cannot afford it” — each needs a different follow-up"
		/>
	{/if}

	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="text-sm text-muted-foreground">
			{#if outcome}
				The plan will be <strong>{PLAN_STATUS_LABEL[outcome].toLowerCase()}</strong>, agreeing
				<strong class="tabular-nums">{formatETB(agreed)}</strong>.
			{:else}
				Answer every line to save.
			{/if}
		</p>
		<Button type="submit" disabled={!outcome || $delayed}>
			{#if $delayed}
				<LoadingBtn name="Saving" />
			{:else}
				<Save class="size-4" /> Record the answer
			{/if}
		</Button>
	</div>
</form>
