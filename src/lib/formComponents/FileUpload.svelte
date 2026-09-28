<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input/index';
	import { Label } from '$lib/components/ui/label/index.js';
	import X from '@lucide/svelte/icons/x';
	import UploadCloud from '@lucide/svelte/icons/cloud-upload';
	import FileText from '@lucide/svelte/icons/file-text';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Loader from '@lucide/svelte/icons/loader';
	import { fileProxy } from 'sveltekit-superforms';
	import imageCompression from 'browser-image-compression';
	import { fileUrl } from '$lib/global.svelte';

	let {
		form,
		name,
		placeholder = 'PDF or Images (Max 10MB)',
		image = '',
		compress = true
	} = $props();

	let file = $state(fileProxy(form, name));
	let isDragging = $state(false);
	let isProcessing = $state(false);

	async function handleFileSelection(files: FileList | null) {
		if (!files || files.length === 0) return;

		isProcessing = true;

		const options = {
			maxSizeMB: 1,
			maxWidthOrHeight: 1920,
			useWebWorker: true,
			initialQuality: 0.8
		};

		try {
			const processedFiles = await Promise.all(
				Array.from(files).map(async (f) => {
					// Off for a radiograph: shrinking one to fit a phone screen throws away the detail
					// it was taken to show. On for everything else, where upload size is the cost.
					if (f.type === 'application/pdf' || !compress) return f;
					try {
						const compressed = await imageCompression(f, options);
						// ✅ Convert Blob → File, preserving the original filename
						return new File([compressed], f.name, { type: compressed.type });
					} catch (err) {
						console.error('Compression error:', err);
						return f;
					}
				})
			);
			// ✅ Use DataTransfer to build a real FileList
			const dt = new DataTransfer();
			processedFiles.forEach((f) => dt.items.add(f));
			file.set(dt.files);
		} catch (err) {
			console.error('FULL ERROR:', err);
		} finally {
			isProcessing = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false; // ✅ already there, good
		if (e.dataTransfer?.files) {
			handleFileSelection(e.dataTransfer.files);
		}
	}
	function handleDragOver(e: DragEvent) {
		e.preventDefault(); // ✅ required to allow drop
		isDragging = true;
	}
	function handleDragLeave() {
		isDragging = false;
	}
</script>

<div class="flex w-full flex-col gap-3">
	<Input
		id={name}
		type="file"
		class="hidden"
		bind:files={$file}
		{name}
		accept="image/*,application/pdf"
		onchange={(e) => handleFileSelection(e.currentTarget.files)}
		multiple={false}
	/>

	{#if $file?.length === 0 && image === ''}
		<Label
			for={name}
			class="group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-2! transition-all
            {isDragging
				? 'border-primary bg-primary/5'
				: 'border-muted-foreground/25 bg-muted/50 hover:border-primary/50 hover:bg-muted'}"
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
		>
			<div class="flex flex-col items-center justify-center gap-2 text-center">
				<div
					class="rounded-full bg-background p-3 shadow-sm transition-transform group-hover:scale-110"
				>
					{#if isProcessing}
						<Loader class="h-6 w-6 animate-spin text-primary" />
					{:else}
						<UploadCloud class="h-6 w-6 {isDragging ? 'text-primary' : 'text-muted-foreground'}" />
					{/if}
				</div>
				<div class="px-4">
					<p class="text-sm font-medium">
						{#if isProcessing}
							Optimizing file...
						{:else}
							{isDragging ? 'Drop it here!' : 'Click to upload or drag and drop'}
						{/if}
					</p>
					<p class="text-[12px]! text-muted-foreground">{placeholder}</p>
				</div>
			</div>
		</Label>
	{:else if image && $file?.length === 0}
		<div
			class="relative animate-in overflow-hidden rounded-xl border bg-card p-4 shadow-sm duration-200 zoom-in-95 fade-in"
		>
			<div class="mb-3 flex items-center justify-between">
				<div class="flex items-center gap-3 overflow-hidden">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						{#if image.toLowerCase().endsWith('.pdf')}
							<FileText class="h-5 w-5" />
						{:else}
							<ImageIcon class="h-5 w-5" />
						{/if}
					</div>
					<div class="flex flex-col truncate">
						<span class="truncate text-sm font-medium">{image}</span>
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon"
					class="hover:text-destructive-foreground h-8 w-8 rounded-full hover:bg-destructive"
					onclick={() => {
						file.set(undefined);
						image = '';
					}}
				>
					<X class="h-4 w-4" />
				</Button>
			</div>

			<div class="overflow-hidden rounded-lg border bg-muted/30">
				{#if image.toLowerCase().endsWith('.pdf')}
					<iframe src={fileUrl(image)} class="h-64 w-full" frameborder="0" title="pdf-preview"
					></iframe>
				{:else}
					<img src={fileUrl(image)} class="max-h-80 w-full object-contain" alt="Preview" />
				{/if}
			</div>
		</div>
	{:else}
		<div
			class="relative animate-in overflow-hidden rounded-xl border bg-card p-4 shadow-sm duration-200 zoom-in-95 fade-in"
		>
			<div class="mb-3 flex items-center justify-between">
				<div class="flex items-center gap-3 overflow-hidden">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						{#if $file[0]?.type === 'application/pdf'}
							<FileText class="h-5 w-5" />
						{:else}
							<ImageIcon class="h-5 w-5" />
						{/if}
					</div>
					<div class="flex flex-col truncate">
						<span class="truncate text-sm font-medium">{$file[0]?.name}</span>
						<span class="text-xs text-muted-foreground">
							{($file[0]?.size / 1024 / 1024).toFixed(2)} MB (Optimized)
						</span>
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon"
					class="hover:text-destructive-foreground h-8 w-8 rounded-full hover:bg-destructive"
					onclick={() => file.set(undefined)}
				>
					<X class="h-4 w-4" />
				</Button>
			</div>

			<div class="overflow-hidden rounded-lg border bg-muted/30">
				{#if $file[0]}
					{#if $file[0]?.type === 'application/pdf'}
						<iframe
							src={URL.createObjectURL($file[0]) + '#toolbar=0'}
							class="h-64 w-full"
							frameborder="0"
							title="pdf-preview"
						></iframe>
					{:else}
						<img
							src={URL.createObjectURL($file[0])}
							class="max-h-80 w-full object-contain"
							alt="Preview"
						/>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</div>
