<script lang="ts">
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import FormDialog from '$lib/formComponents/FormDialog.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import NoteCard from './NoteCard.svelte';
	import { amendNote, editNote, newNote, type AmendNote, type EditNote } from './schema';

	/**
	 * The notes tab: the patient's clinical notes as a timeline, newest first, each correction
	 * beneath the note it corrects. A note is written as a draft or signed at once; a signed note is
	 * corrected by an amendment and never changed (`server/clinicalNotes.ts` says why).
	 */
	let { data } = $props();

	const KINDS = [
		{ value: 'examination', name: 'Examination — what was found' },
		{ value: 'treatment', name: 'Treatment — what was done' },
		{ value: 'telephone', name: 'Telephone call' },
		{ value: 'note', name: 'Other note' }
	];
	const FILTERS = [
		{ value: 'all', name: 'All' },
		...KINDS.map((k) => ({ ...k, name: k.name.split(' — ')[0] }))
	];

	let kindFilter = $state('all');
	const shown = $derived(
		kindFilter === 'all' ? data.notes : data.notes.filter((n) => n.kind === kindFilter)
	);
	const drafts = $derived(data.notes.filter((n) => !n.signedAt && n.authorId === data.me).length);

	let addOpen = $state(false);
	let editOpen = $state(false);
	let editSeed = $state<Partial<EditNote>>({});
	let amendOpen = $state(false);
	let amendSeed = $state<Partial<AmendNote>>({});

	const visits = $derived([{ value: '', name: 'Not about one visit' }, ...data.visits]);
	const providers = $derived([{ value: '', name: 'No clinician named' }, ...data.providers]);

	function edit(note: (typeof data.notes)[number]) {
		editSeed = {
			noteId: note.id,
			kind: note.kind,
			summary: note.summary ?? '',
			body: note.body,
			providerId: note.providerId ? String(note.providerId) : '',
			appointmentId: note.appointmentId ? String(note.appointmentId) : ''
		};
		editOpen = true;
	}

	function amend(note: (typeof data.notes)[number]) {
		amendSeed = { noteId: note.id, summary: '', body: '' };
		amendOpen = true;
	}
</script>

<svelte:head>
	<title>{data.patient.fullName} — Notes</title>
</svelte:head>

<Section title="Clinical notes" IconComp={NotebookPen} style="identityIcon">
	{#snippet editDialog()}
		{#if data.canWrite}
			<Button size="sm" class="ml-auto" onclick={() => (addOpen = true)}>
				<Plus class="size-4" /> Write a note
			</Button>
		{/if}
	{/snippet}

	{#if data.notes.length}
		<div
			class="mb-4 flex flex-wrap items-center gap-2"
			role="group"
			aria-label="Show notes of kind"
		>
			{#each FILTERS as filter (filter.value)}
				<Button
					size="sm"
					variant={kindFilter === filter.value ? 'default' : 'outline'}
					onclick={() => (kindFilter = filter.value)}
				>
					{filter.name}
				</Button>
			{/each}
			{#if drafts}
				<span class="ml-auto text-sm text-muted-foreground">
					{drafts} draft{drafts === 1 ? '' : 's'} of yours not yet signed
				</span>
			{/if}
		</div>

		<div class="flex flex-col gap-3">
			{#each shown as note (note.id)}
				<NoteCard
					{note}
					me={data.me}
					canWrite={data.canWrite}
					step={data.forms.step}
					onedit={() => edit(note)}
					onamend={() => amend(note)}
				/>
				{#each note.amendments as correction (correction.id)}
					<NoteCard
						note={correction}
						me={data.me}
						canWrite={data.canWrite}
						step={data.forms.step}
						amendment
						onedit={() => {}}
						onamend={() => {}}
					/>
				{/each}
			{:else}
				<p class="text-sm text-muted-foreground">No notes of this kind.</p>
			{/each}
		</div>
	{:else}
		<p class="text-sm text-muted-foreground">
			Nothing has been written about this patient yet. Examinations, treatment and telephone calls
			each get a note — a call is a record too, and the one most often lost.
		</p>
	{/if}
</Section>

<FormDialog
	title="Write a note"
	action="?/add"
	data={data.forms.add}
	schema={newNote}
	bind:open={addOpen}
	hideTrigger
	resetOnSuccess
	submitLabel="Save"
	disabled={!data.canWrite}
>
	{#snippet fields({ form, errors })}
		<InputComp label="Kind" name="kind" type="select" {form} {errors} items={KINDS} />
		<InputComp
			label="Summary"
			name="summary"
			{form}
			{errors}
			required={false}
			placeholder="One line, for reading the history at a glance"
		/>
		<InputComp label="Note" name="body" type="textarea" rows={8} {form} {errors} />
		<InputComp
			label="Visit"
			name="appointmentId"
			type="select"
			{form}
			{errors}
			items={visits}
			required={false}
		/>
		<InputComp
			label="Clinician"
			name="providerId"
			type="select"
			{form}
			{errors}
			items={providers}
			required={false}
		/>
		<InputComp
			label="Sign"
			name="sign"
			type="checkboxSingle"
			{form}
			{errors}
			placeholder="Sign it now — leave unticked to save a draft"
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title="Change the draft"
	action="?/edit"
	data={data.forms.edit}
	schema={editNote}
	bind:open={editOpen}
	seed={editSeed}
	hideTrigger
	submitLabel="Save the draft"
	disabled={!data.canWrite}
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="noteId" value={values.noteId} />
		<InputComp label="Kind" name="kind" type="select" {form} {errors} items={KINDS} />
		<InputComp label="Summary" name="summary" {form} {errors} required={false} />
		<InputComp label="Note" name="body" type="textarea" rows={8} {form} {errors} />
		<InputComp
			label="Visit"
			name="appointmentId"
			type="select"
			{form}
			{errors}
			items={visits}
			required={false}
		/>
		<InputComp
			label="Clinician"
			name="providerId"
			type="select"
			{form}
			{errors}
			items={providers}
			required={false}
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title="Amend a signed note"
	description="The note stays exactly as it was signed. The amendment is added beneath it, signed by you, so both the original and the correction can be read."
	action="?/amend"
	data={data.forms.amend}
	schema={amendNote}
	bind:open={amendOpen}
	seed={amendSeed}
	hideTrigger
	submitLabel="Add the amendment"
	disabled={!data.canWrite}
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="noteId" value={values.noteId} />
		<InputComp
			label="Summary"
			name="summary"
			{form}
			{errors}
			required={false}
			placeholder="What is being corrected"
		/>
		<InputComp label="Correction" name="body" type="textarea" rows={6} {form} {errors} />
	{/snippet}
</FormDialog>
