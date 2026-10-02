<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import * as Select from '@nahu/admin-kit/components/ui/select/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import { fileUrl, formatEthiopianDate } from '$lib/global.svelte';
	import { PROJECTION_LABEL, compareCandidate } from '$lib/radiographs';
	import RadiographPane from './RadiographPane.svelte';
	import { freshView } from './view';

	/**
	 * A patient's radiographs, read two at a time: the film chosen, and beside it the last film of
	 * the same kind (`compareCandidate`) — or any other, or none. "Move together" gives both panes
	 * one view, so zooming into a root on this year's film zooms into it on last year's.
	 */
	let { data } = $props();

	type Film = (typeof data.films)[number];

	// svelte-ignore state_referenced_locally
	let chosenId = $state(data.initial);
	/** The film beside it: `auto` follows the chosen film, a number is the reader's own pick. */
	let besideChoice = $state<'auto' | 'none' | number>('auto');
	let linked = $state(true);
	let left = $state(freshView());
	let right = $state(freshView());

	const chosen = $derived(data.films.find((f) => f.id === chosenId) ?? null);
	const beside = $derived.by(() => {
		if (!chosen || besideChoice === 'none') return null;
		if (besideChoice === 'auto') return compareCandidate(chosen, data.films);
		return data.films.find((f) => f.id === besideChoice) ?? null;
	});

	const base = $derived(`/dashboard/patients/${data.patient.id}/files`);
	const day = (iso: string) => formatEthiopianDate(new Date(iso));
	const labelOf = (f: Film) =>
		[
			day(f.madeOn),
			f.projection ? PROJECTION_LABEL[f.projection] : 'Radiograph',
			f.toothId ? `tooth ${f.toothId}` : null,
			f.description
		]
			.filter(Boolean)
			.join(' · ');

	const besideLabel = $derived(
		besideChoice === 'auto'
			? 'The last film of the same kind'
			: besideChoice === 'none'
				? 'Nothing — this film alone'
				: beside
					? labelOf(beside)
					: '—'
	);

	function pickBeside(value: string) {
		besideChoice = value === 'auto' || value === 'none' ? value : Number(value);
	}

	function choose(id: number) {
		chosenId = id;
		besideChoice = 'auto';
		left = freshView();
		right = freshView();
	}
</script>

<svelte:head>
	<title>{data.patient.fullName} — Radiographs</title>
</svelte:head>

<Section title="Radiographs" IconComp={ScanLine} style="identityIcon">
	{#snippet editDialog()}
		<Button href={base} variant="ghost" size="sm" class="ml-auto">
			<ArrowLeft class="size-4" /> All files
		</Button>
	{/snippet}

	{#if !chosen}
		<p class="text-sm text-muted-foreground">
			No radiographs are attached. Attach one on the Files tab, or file one from the radiograph
			inbox.
		</p>
	{:else}
		<div class="flex flex-col gap-4">
			<div class="flex flex-wrap items-center gap-3 text-sm">
				<span class="text-muted-foreground">Beside it</span>
				<Select.Root type="single" value={String(besideChoice)} onValueChange={pickBeside}>
					<Select.Trigger class="h-9 w-auto max-w-full min-w-56" aria-label="Beside it">
						<span class="truncate">{besideLabel}</span>
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="auto">The last film of the same kind</Select.Item>
						<Select.Item value="none">Nothing — this film alone</Select.Item>
						<Select.Separator />
						{#each data.films.filter((f) => f.id !== chosen.id) as f (f.id)}
							<Select.Item value={String(f.id)}>{labelOf(f)}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				{#if beside}
					<label class="flex items-center gap-2">
						<input type="checkbox" class="size-4" bind:checked={linked} />
						Move together
					</label>
				{:else if besideChoice === 'auto'}
					<span class="text-muted-foreground">No earlier film of this kind to compare with.</span>
				{/if}
			</div>

			<div class="grid gap-4 {beside ? 'lg:grid-cols-2' : ''}">
				<RadiographPane
					src={fileUrl(chosen.storedName)}
					full={fileUrl(chosen.storedName)}
					label={labelOf(chosen)}
					bind:view={left}
				/>
				{#if beside}
					{#if linked}
						<RadiographPane
							src={fileUrl(beside.storedName)}
							full={fileUrl(beside.storedName)}
							label={labelOf(beside)}
							bind:view={left}
						/>
					{:else}
						<RadiographPane
							src={fileUrl(beside.storedName)}
							full={fileUrl(beside.storedName)}
							label={labelOf(beside)}
							bind:view={right}
						/>
					{/if}
				{/if}
			</div>

			<div>
				<p class="mb-2 text-sm font-medium">All radiographs, newest first</p>
				<ul class="flex gap-2 overflow-x-auto pb-2">
					{#each data.films as f (f.id)}
						<li class="shrink-0">
							<button
								type="button"
								class="flex w-32 flex-col gap-1 rounded-md border p-1 text-left text-xs {f.id ===
								chosen.id
									? 'border-primary ring-2 ring-primary'
									: f.id === beside?.id
										? 'border-primary'
										: ''}"
								aria-pressed={f.id === chosen.id}
								onclick={() => choose(f.id)}
							>
								<img
									src={fileUrl(f.storedName)}
									alt={labelOf(f)}
									loading="lazy"
									class="aspect-4/3 w-full rounded-sm bg-black object-contain"
								/>
								<span class="line-clamp-2">{labelOf(f)}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}
</Section>
