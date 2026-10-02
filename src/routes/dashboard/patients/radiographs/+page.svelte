<script lang="ts">
	import FolderInput from '@lucide/svelte/icons/folder-input';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import PatientPicker from '$lib/components/PatientPicker.svelte';
	import { clinicDate } from '$lib/clinicTime';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { PROJECTIONS, PROJECTION_LABEL } from '$lib/radiographs';
	import { fileImage, type FileImage } from './schema';

	/**
	 * The radiograph inbox: what the X-ray machines have exported and nobody has filed yet, oldest
	 * first, each with a preview and a File button. One dialog serves every image; it starts on the
	 * day the machine wrote the file.
	 */
	let { data } = $props();

	let open = $state(false);
	let seed = $state<Partial<FileImage>>({});

	const projections = [
		{ value: '', name: 'Not recorded' },
		...PROJECTIONS.map((p) => ({ value: p, name: PROJECTION_LABEL[p] }))
	];

	function fileOne(file: (typeof data.files)[number]) {
		seed = {
			name: file.name,
			takenOn: clinicDate(file.modified),
			projection: '',
			toothId: '',
			description: ''
		};
		open = true;
	}

	const size = (bytes: number) =>
		bytes > 1_048_576
			? `${(bytes / 1_048_576).toFixed(1)} MB`
			: `${Math.max(1, Math.round(bytes / 1024))} KB`;
	const preview = (name: string) => `/dashboard/patients/radiographs/${encodeURIComponent(name)}`;
</script>

<svelte:head>
	<title>Radiograph inbox</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<Section title="Radiograph inbox" IconComp={FolderInput} style="identityIcon">
		{#if !data.configured}
			<p class="text-sm text-muted-foreground">
				No inbox folder is set up. Set <code>RADIOGRAPH_INBOX</code> on the server to the folder the X-ray
				sensor's or panoramic machine's software exports into, as JPEG or PNG. Until then, attach radiographs
				one by one on a patient's Files tab.
			</p>
		{:else if !data.files.length}
			<p class="text-sm text-muted-foreground">
				Nothing is waiting. Images the X-ray software exports appear here to be filed to a patient.
			</p>
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each data.files as file (file.name)}
					<article class="flex flex-col overflow-hidden rounded-lg border bg-card">
						{#if file.fileable}
							<a
								href={preview(file.name)}
								target="_blank"
								rel="noopener"
								class="flex aspect-4/3 items-center justify-center bg-black"
							>
								<img
									src={preview(file.name)}
									alt={file.name}
									loading="lazy"
									class="size-full object-contain"
								/>
							</a>
						{:else}
							<div
								class="flex aspect-4/3 items-center justify-center bg-muted p-4 text-center text-sm text-muted-foreground"
							>
								{file.format === 'dicom' || file.format === 'tiff'
									? `${file.format.toUpperCase()} cannot be shown in a browser. Set the X-ray software to export JPEG or PNG.`
									: 'Not an image.'}
							</div>
						{/if}
						<div class="flex flex-col gap-1 p-3 text-sm">
							<p class="truncate font-medium" title={file.name}>{file.name}</p>
							<p class="text-xs text-muted-foreground">
								{formatEthiopianDate(new Date(clinicDate(file.modified)))} · {size(file.size)}
							</p>
							<div class="mt-1 flex items-center justify-between">
								<Badge variant="outline">{file.format.toUpperCase()}</Badge>
								{#if file.fileable}
									<Button size="sm" onclick={() => fileOne(file)}>File to a patient</Button>
								{/if}
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</Section>
</div>

<FormDialog
	title="File to a patient"
	description="The image is copied onto the patient's chart as a radiograph; the export is kept in the inbox's filed folder."
	action="?/file"
	data={data.form}
	schema={fileImage}
	bind:open
	{seed}
	hideTrigger
	resetOnSuccess
	submitLabel="File"
>
	{#snippet fields({ form, errors, values })}
		<!-- Which image: seeded when the dialog opens, and posted like any other field. -->
		<input type="hidden" name="name" value={values.name ?? ''} />
		<p class="truncate text-sm text-muted-foreground">{values.name}</p>
		<PatientPicker {form} />
		<InputComp
			label="Projection"
			name="projection"
			type="select"
			items={projections}
			required={false}
			{form}
			{errors}
		/>
		<InputComp
			label="Tooth"
			name="toothId"
			required={false}
			placeholder="FDI number, like 36 — only for a film of one tooth"
			{form}
			{errors}
		/>
		<InputComp
			label="When it was taken"
			name="takenOn"
			type="date"
			oldDays
			allowEmpty
			required={false}
			{form}
			{errors}
		/>
		<InputComp label="Description" name="description" required={false} {form} {errors} />
	{/snippet}
</FormDialog>
