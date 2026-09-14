<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { Writable } from 'svelte/store';

	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	/**
	 * Choose a patient by searching for them — for any form with a `patientId`.
	 *
	 * A search box rather than a dropdown, because a dropdown has to load every patient first: that
	 * is thousands of rows into the page, and exactly the roster CLAUDE.md §15 keeps branch scoped.
	 * This asks `/dashboard/appointments/patients` for at most ten matches as the receptionist types,
	 * using the same search as the patient list — names in any order, file number, any phone.
	 *
	 * A result shows its severe allergies and its branch before it is picked, so the wrong Abebe
	 * Kebede is noticed at the moment of choosing rather than at the chair.
	 */

	/* eslint-disable @typescript-eslint/no-explicit-any */
	/** The superforms `$form` store, typed loosely for the same reason as in `InputComp`. */
	type FormStore = Writable<Record<string, any>>;
	/* eslint-enable @typescript-eslint/no-explicit-any */

	type Result = {
		id: number;
		name: string;
		fileNo: string | null;
		phone: string | null;
		branch: string | null;
		fromOtherBranch: boolean;
		severeAllergies: string[];
	};

	let {
		form,
		name = 'patientId',
		initial = null,
		error
	}: {
		form: FormStore;
		name?: string;
		/** A patient already chosen — the chart's "Book appointment" passes its own patient. */
		initial?: { id: number; name: string; fileNo: string | null } | null;
		error?: string[];
	} = $props();

	// svelte-ignore state_referenced_locally
	let chosen = $state<{ id: number; name: string; fileNo: string | null } | null>(initial);
	let query = $state('');
	let results = $state<Result[]>([]);
	let searching = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function search(value: string) {
		query = value;
		clearTimeout(timer);
		if (value.trim().length < 2) {
			results = [];
			return;
		}
		timer = setTimeout(async () => {
			searching = true;
			try {
				const response = await fetch(
					`/dashboard/appointments/patients?q=${encodeURIComponent(value.trim())}`
				);
				results = response.ok ? await response.json() : [];
			} finally {
				searching = false;
			}
		}, 250);
	}

	function pick(result: Result) {
		chosen = { id: result.id, name: result.name, fileNo: result.fileNo };
		$form[name] = result.id;
		results = [];
		query = '';
	}

	function clear() {
		chosen = null;
		$form[name] = undefined;
	}
</script>

<div class="flex flex-col gap-2">
	<span class="text-sm font-medium">Patient</span>
	<input type="hidden" {name} value={chosen?.id ?? ''} />

	{#if chosen}
		<div class="flex items-center justify-between rounded-md border px-3 py-2">
			<div class="flex flex-col">
				<span class="font-medium">{chosen.name}</span>
				<span class="text-xs text-muted-foreground">
					{chosen.fileNo ? `File ${chosen.fileNo}` : 'No file number'}
				</span>
			</div>
			<Button variant="ghost" size="icon" aria-label="Choose a different patient" onclick={clear}>
				<X class="size-4" />
			</Button>
		</div>
	{:else}
		<div class="relative">
			<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				class="pl-9"
				placeholder="Name, file number or phone"
				value={query}
				oninput={(e) => search(e.currentTarget.value)}
				aria-invalid={error?.length ? 'true' : undefined}
			/>
		</div>

		{#if searching}
			<p class="text-xs text-muted-foreground">Searching…</p>
		{:else if query.trim().length >= 2 && !results.length}
			<p class="text-xs text-muted-foreground">
				No patient matches. Register them first from Patients → Register a patient.
			</p>
		{/if}

		{#if results.length}
			<ul class="flex max-h-64 flex-col divide-y overflow-auto rounded-md border">
				{#each results as result (result.id)}
					<li>
						<button
							type="button"
							class="flex w-full flex-col items-start gap-1 px-3 py-2 text-left hover:bg-accent"
							onclick={() => pick(result)}
						>
							<span class="font-medium">{result.name}</span>
							<span class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								{result.fileNo ? `File ${result.fileNo}` : 'No file number'}
								{#if result.phone}· {result.phone}{/if}
								{#if result.fromOtherBranch}
									<Badge variant="outline">{result.branch ?? 'Other branch'}</Badge>
								{/if}
								{#each result.severeAllergies as allergy (allergy)}
									<Badge variant="destructive" class="gap-1">
										<TriangleAlert class="size-3" />{allergy}
									</Badge>
								{/each}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	{#if error?.length}
		<p class="text-sm text-destructive" role="alert">{error[0]}</p>
	{/if}
</div>
