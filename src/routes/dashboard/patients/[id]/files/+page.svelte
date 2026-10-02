<script lang="ts">
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import { PROJECTIONS, PROJECTION_LABEL } from '$lib/radiographs';
	import FileCard from './FileCard.svelte';
	import { attach } from './schema';

	/**
	 * The files tab: what is attached to the patient, newest first, filterable by kind, and
	 * attaching another. Opening a file opens it full size in a new tab.
	 */
	let { data } = $props();

	const KINDS = [
		{ value: 'radiograph', name: 'Radiograph' },
		{ value: 'photo', name: 'Photograph' },
		{ value: 'paperRecord', name: 'Paper record (an old chart)' },
		{ value: 'consent', name: 'Consent form' },
		{ value: 'referral', name: 'Referral letter' },
		{ value: 'labResult', name: 'Lab result' },
		{ value: 'other', name: 'Other' }
	];

	let kindFilter = $state('all');
	const present = $derived(KINDS.filter((k) => data.files.some((f) => f.kind === k.value)));
	const shown = $derived(
		kindFilter === 'all' ? data.files : data.files.filter((f) => f.kind === kindFilter)
	);
	const visits = $derived([{ value: '', name: 'Not from one visit' }, ...data.visits]);

	let attachOpen = $state(false);
	const projections = [
		{ value: '', name: 'Not recorded' },
		...PROJECTIONS.map((p) => ({ value: p, name: PROJECTION_LABEL[p] }))
	];
	const viewer = $derived(`/dashboard/patients/${data.patient.id}/files/radiographs`);
	const radiographs = $derived(data.files.filter((f) => f.kind === 'radiograph').length);
</script>

<svelte:head>
	<title>{data.patient.fullName} — Files</title>
</svelte:head>

<Section title="Files" IconComp={Paperclip} style="identityIcon">
	{#snippet editDialog()}
		{#if radiographs}
			<Button size="sm" variant="outline" class="ml-auto" href={viewer}>
				<ScanLine class="size-4" /> View radiographs ({radiographs})
			</Button>
		{/if}
		{#if data.canAttach}
			<Button size="sm" class={radiographs ? '' : 'ml-auto'} onclick={() => (attachOpen = true)}>
				<Plus class="size-4" /> Attach a file
			</Button>
		{/if}
	{/snippet}

	{#if data.files.length}
		{#if present.length > 1}
			<div class="mb-4 flex flex-wrap gap-2" role="group" aria-label="Show files of kind">
				<Button
					size="sm"
					variant={kindFilter === 'all' ? 'default' : 'outline'}
					onclick={() => (kindFilter = 'all')}>All</Button
				>
				{#each present as kind (kind.value)}
					<Button
						size="sm"
						variant={kindFilter === kind.value ? 'default' : 'outline'}
						onclick={() => (kindFilter = kind.value)}>{kind.name}</Button
					>
				{/each}
			</div>
		{/if}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
			{#each shown as file (file.id)}
				<FileCard {file} {viewer} remove={data.canRemove ? data.forms.remove : null} />
			{/each}
		</div>
	{:else}
		<p class="text-sm text-muted-foreground">
			Nothing is attached yet. Radiographs, clinical photographs, referral letters — and old paper
			charts, photographed at the desk — all belong here.
		</p>
	{/if}
</Section>

<FormDialog
	title="Attach a file"
	action="?/attach"
	data={data.forms.attach}
	schema={attach}
	bind:open={attachOpen}
	hideTrigger
	resetOnSuccess
	multipart
	submitLabel="Attach"
	disabled={!data.canAttach}
>
	{#snippet fields({ form, errors, values })}
		<InputComp label="What it is" name="kind" type="select" {form} {errors} items={KINDS} />
		{#if values.kind === 'radiograph'}
			<InputComp
				label="Projection"
				name="projection"
				type="select"
				items={projections}
				required={false}
				{form}
				{errors}
				description="So the viewer can set it beside the last film of the same kind."
			/>
		{/if}
		<InputComp
			label="File"
			name="file"
			type="file"
			{form}
			{errors}
			compress={values.kind !== 'radiograph'}
			placeholder={values.kind === 'radiograph'
				? 'The image as exported, full size (max 10MB)'
				: 'A photo or PDF (max 10MB)'}
		/>
		<InputComp
			label="When it was made"
			name="takenOn"
			type="date"
			oldDays
			allowEmpty
			required={false}
			{form}
			{errors}
			description="For a photographed paper chart, the date on the paper — not today."
		/>
		<InputComp
			label="Tooth"
			name="toothId"
			{form}
			{errors}
			required={false}
			placeholder="FDI number, like 36 — only for a film of one tooth"
		/>
		<InputComp label="Description" name="description" {form} {errors} required={false} />
		<InputComp
			label="Visit"
			name="appointmentId"
			type="select"
			{form}
			{errors}
			items={visits}
			required={false}
		/>
	{/snippet}
</FormDialog>
