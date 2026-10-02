<script lang="ts">
	import GitMerge from '@lucide/svelte/icons/git-merge';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import PatientPicker from '$lib/components/PatientPicker.svelte';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import type { PossibleDuplicate } from '$lib/server/patients';
	import { mergeForm } from './mergeSchema';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	/**
	 * Merging a duplicate registration into this chart — a super admin's. The records the
	 * registration check would have warned about are listed, each with its reason; any other record
	 * can be found by name. What a merge moves and keeps is `server/patientMerge.ts`'s to say.
	 */
	let {
		duplicates,
		form,
		pick
	}: {
		duplicates: PossibleDuplicate[];
		/** Shared by the row buttons, each of which gives it its own id. */
		form: SuperValidated<Record<string, unknown>>;
		/** The search dialog's own. */
		pick: SuperValidated<Record<string, unknown>>;
	} = $props();

	const t = useI18n();
	const g = $derived(t.m.patients.merge);
	let pickOpen = $state(false);
	const confirm = (who: string) => ({
		title: g.confirmTitle(who),
		description: g.confirmText,
		action: g.confirm
	});
</script>

<Section title={g.title} IconComp={GitMerge} style="systemIcon" class="lg:col-span-3">
	{#snippet editDialog()}
		<Button size="sm" variant="outline" class="ml-auto" onclick={() => (pickOpen = true)}>
			{g.find}
		</Button>
	{/snippet}
	{#if duplicates.length}
		<ul class="flex flex-col divide-y text-sm">
			{#each duplicates as other (other.id)}
				<li class="flex flex-wrap items-center gap-3 py-2">
					<a class="font-medium underline" href="/dashboard/patients/{other.id}">{other.name}</a>
					<span class="text-muted-foreground">
						{other.fileNo ? `${t.m.patients.file(other.fileNo)} · ` : ''}{other.reason}
					</span>
					<span class="ml-auto">
						<StepButton
							id="merge-{other.id}"
							action="?/merge"
							data={form}
							label={g.intoThis}
							icon={GitMerge}
							values={{ duplicateId: other.id }}
							confirm={confirm(other.name)}
						/>
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-muted-foreground">
			{g.none}
		</p>
	{/if}
</Section>

<FormDialog
	title={g.pickTitle}
	description={g.pickText}
	action="?/merge"
	data={pick}
	schema={mergeForm}
	bind:open={pickOpen}
	hideTrigger
	submitLabel={g.confirm}
>
	{#snippet fields({ form: store })}
		<PatientPicker form={store} name="duplicateId" />
	{/snippet}
</FormDialog>
