<script lang="ts">
	import FileText from '@lucide/svelte/icons/file-text';
	import Trash from '@lucide/svelte/icons/trash-2';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import { fileUrl, formatEthiopianDate } from '$lib/global.svelte';
	import { PROJECTION_LABEL } from '$lib/radiographs';
	import type { patientFiles } from '$lib/server/patientFiles';

	/**
	 * One attached file: a thumbnail for an image, an icon for anything else, and what it is. The
	 * whole card opens the file in a new tab, full size — except a radiograph, which opens in the
	 * viewer beside the last film of the same kind.
	 */
	let {
		file,
		viewer,
		remove
	}: {
		file: Awaited<ReturnType<typeof patientFiles>>[number];
		/** The patient's radiograph viewer. */
		viewer: string;
		/** The remove step's form, for a super admin; null for everyone else. */
		remove: SuperValidated<Record<string, unknown>> | null;
	} = $props();

	const KIND = {
		radiograph: 'Radiograph',
		photo: 'Photograph',
		consent: 'Consent form',
		referral: 'Referral',
		labResult: 'Lab result',
		paperRecord: 'Paper record',
		other: 'Other'
	} as const;

	const isImage = $derived(file.mimeType?.startsWith('image/') ?? false);
	const size = $derived(
		file.sizeBytes === null
			? ''
			: file.sizeBytes > 1_048_576
				? `${(file.sizeBytes / 1_048_576).toFixed(1)} MB`
				: `${Math.max(1, Math.round(file.sizeBytes / 1024))} KB`
	);
</script>

<article class="flex flex-col overflow-hidden rounded-lg border bg-card">
	<a
		href={file.kind === 'radiograph' ? `${viewer}?film=${file.id}` : fileUrl(file.storedName)}
		target={file.kind === 'radiograph' ? undefined : '_blank'}
		rel="noopener"
		class="flex aspect-4/3 items-center justify-center bg-muted"
		aria-label="Open {file.description ?? file.originalName ?? KIND[file.kind]}"
	>
		{#if isImage}
			<img
				src={fileUrl(file.storedName)}
				alt={file.description ?? KIND[file.kind]}
				loading="lazy"
				class="size-full object-cover"
			/>
		{:else}
			<FileText class="size-10 text-muted-foreground" />
		{/if}
	</a>
	<div class="flex flex-col gap-1 p-3 text-sm">
		<div class="flex flex-wrap items-center gap-1">
			<Badge variant="secondary">
				{file.projection ? PROJECTION_LABEL[file.projection] : KIND[file.kind]}
			</Badge>
			{#if file.toothId}<Badge variant="outline">Tooth {file.toothId}</Badge>{/if}
		</div>
		{#if file.description}<p class="font-medium">{file.description}</p>{/if}
		<p class="text-xs text-muted-foreground">
			{file.takenOn ? `Made ${formatEthiopianDate(new Date(file.takenOn))} · ` : ''}Added
			{formatEthiopianDate(new Date(file.createdAt))}{file.uploadedBy
				? ` by ${file.uploadedBy}`
				: ''}
			{size ? ` · ${size}` : ''}
		</p>
		{#if remove}
			<div class="mt-1 self-end">
				<StepButton
					id="remove-file-{file.id}"
					action="?/remove"
					data={remove}
					label="Remove"
					icon={Trash}
					variant="ghost"
					values={{ fileId: file.id }}
					confirm={{
						title: 'Take this file off the chart?',
						description:
							'For a file attached to the wrong patient, or by mistake. It is kept, and the removal is on the audit trail.',
						action: 'Remove'
					}}
				/>
			</div>
		{/if}
	</div>
</article>
