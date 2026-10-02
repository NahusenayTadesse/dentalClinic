<script lang="ts">
	import {
		DEEP,
		PERIO_LIMITS,
		PERIO_SITE_NAMES,
		VERY_DEEP,
		WORSE_BY,
		attachmentChanges,
		hasFurcation,
		isUpper,
		siteKey,
		sitesOnScreen,
		type PerioFace,
		type PerioSite,
		type SiteReading,
		type ToothReading
	} from '$lib/perio';
	import { CHART_ROWS } from '$lib/teeth';

	/**
	 * The periodontal chart as a clinician reads one: the upper arch then the lower, the patient's
	 * right on the left, each tooth's three cheek-side sites above its three tongue-side ones.
	 *
	 * Entry is built for one person probing and another typing. Enter moves along the row; with
	 * "move on after each number" ticked, a single digit does — the fast way, though a 10 mm pocket
	 * then needs the box ticked off. In a pocket box, `b` marks bleeding and `p` plaque at that site.
	 *
	 * With an earlier exam, its depth sits under each reading, and a site whose attachment is
	 * `WORSE_BY` mm or more worse is outlined.
	 */
	let {
		teeth = $bindable(),
		previous = null,
		readonly = false
	}: {
		teeth: ToothReading[];
		previous?: ToothReading[] | null;
		readonly?: boolean;
	} = $props();

	let autoAdvance = $state(true);
	/**
	 * The pocket most recently typed. With auto-advance the box has already moved on when the
	 * dentist calls "bleeding", so `b` in an empty box marks this one. Forgotten on a click, which
	 * is someone choosing a site.
	 */
	let lastTyped: { code: number; site: PerioSite } | null = null;
	let grid: HTMLElement | undefined = $state();

	const index = $derived(new Map(teeth.map((t, i) => [t.tooth, i])));
	const before = $derived(previous ? new Map(previous.map((t) => [t.tooth, t])) : null);
	const changes = $derived(previous ? attachmentChanges(previous, teeth) : null);

	const arches = [
		{ name: 'Upper', teeth: [...CHART_ROWS.permanent.upper[0], ...CHART_ROWS.permanent.upper[1]] },
		{ name: 'Lower', teeth: [...CHART_ROWS.permanent.lower[0], ...CHART_ROWS.permanent.lower[1]] }
	];

	/** One column per site across an arch: sixteen teeth of three. */
	const SITE_COLUMNS = Array.from({ length: 48 }, (_, n) => n);

	const faceLabel = (face: PerioFace, upper: boolean) =>
		face === 'buccal' ? 'Buccal' : upper ? 'Palatal' : 'Lingual';

	/** Replaces one tooth, so the bound array is reassigned and the form sees the change. */
	function edit(code: number, change: (t: ToothReading) => ToothReading) {
		const i = index.get(code);
		if (i === undefined) return;
		teeth = teeth.map((t, j) => (j === i ? change(t) : t));
	}

	function editSite(code: number, site: PerioSite, patch: Partial<SiteReading>) {
		edit(code, (t) => ({ ...t, sites: { ...t.sites, [site]: { ...t.sites[site], ...patch } } }));
	}

	/** A typed number inside its limits, null for an empty box, or undefined to refuse the keystroke. */
	function parse(raw: string, limits: { min: number; max: number }): number | null | undefined {
		const text = raw.trim().replace('−', '-');
		if (text === '' || text === '-') return null;
		const n = Number(text);
		return Number.isInteger(n) && n >= limits.min && n <= limits.max ? n : undefined;
	}

	/** Focuses the next box in the same row of the chart, wrapping from the upper arch to the lower. */
	function next(from: HTMLInputElement) {
		const row = from.dataset.row;
		if (!grid || !row) return;
		const boxes = [
			...grid.querySelectorAll<HTMLInputElement>(`input[data-row="${row}"]:not(:disabled)`)
		];
		boxes[boxes.indexOf(from) + 1]?.focus();
	}

	function onNumber(
		event: Event & { currentTarget: HTMLInputElement },
		limits: { min: number; max: number },
		write: (n: number | null) => void
	) {
		const box = event.currentTarget;
		const value = parse(box.value, limits);
		if (value === undefined) {
			box.value = box.value.slice(0, -1);
			return;
		}
		write(value);
		if (autoAdvance && /^\d$/.test(box.value.trim())) next(box);
	}

	function onKey(
		event: KeyboardEvent & { currentTarget: HTMLInputElement },
		code: number,
		site: PerioSite | null
	) {
		if (event.key === 'Enter') {
			event.preventDefault();
			next(event.currentTarget);
		} else if (site && (event.key === 'b' || event.key === 'p')) {
			event.preventDefault();
			const target = event.currentTarget.value === '' && lastTyped ? lastTyped : { code, site };
			const t = teeth[index.get(target.code) ?? -1];
			if (!t) return;
			const field = event.key === 'b' ? 'bleeding' : 'plaque';
			editSite(target.code, target.site, { [field]: !t.sites[target.site][field] });
		}
	}

	const shown = (n: number | null) => (n === null ? '' : String(n));

	function depthClass(depth: number | null) {
		if (depth === null) return '';
		if (depth >= VERY_DEEP) return 'text-destructive font-bold';
		if (depth >= DEEP) return 'text-amber-600 dark:text-amber-400 font-semibold';
		return '';
	}

	/** The midline, drawn once, before the first site of the patient's left half. */
	const mid = (i: number, k = 0) =>
		i === 8 && k === 0 ? 'border-l-2 border-muted-foreground/40 pl-1' : '';

	const worse = (code: number, site: PerioSite) =>
		(changes?.get(siteKey(code, site)) ?? 0) >= WORSE_BY;

	const box =
		'h-7 print:h-5 w-full min-w-0 rounded-sm border border-input bg-background px-0 text-center text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted disabled:text-muted-foreground';
</script>

{#snippet siteMarks(t: ToothReading, site: PerioSite)}
	{@const s = t.sites[site]}
	<div class="flex justify-center gap-px">
		<button
			type="button"
			class="size-2 rounded-full border border-destructive print:size-1.5 {s.bleeding
				? 'bg-destructive'
				: ''}"
			aria-pressed={s.bleeding}
			aria-label="Bleeding at {t.tooth} {PERIO_SITE_NAMES[site]}"
			title="Bleeding"
			disabled={readonly || t.missing}
			onclick={() => editSite(t.tooth, site, { bleeding: !s.bleeding })}
		></button>
		<button
			type="button"
			class="size-2 rounded-full border border-primary print:size-1.5 {s.plaque
				? 'bg-primary'
				: ''}"
			aria-pressed={s.plaque}
			aria-label="Plaque at {t.tooth} {PERIO_SITE_NAMES[site]}"
			title="Plaque"
			disabled={readonly || t.missing}
			onclick={() => editSite(t.tooth, site, { plaque: !s.plaque })}
		></button>
	</div>
{/snippet}

{#snippet faceRows(archTeeth: number[], face: PerioFace, upper: boolean, archName: string)}
	{@const label = faceLabel(face, upper)}
	<tr>
		<th class="pt-2 pr-2 text-left text-xs font-semibold" colspan="1">{label}</th>
	</tr>
	<tr>
		<th class="pr-2 text-left text-[11px] font-normal text-muted-foreground print:text-[8px]"
			>Bleeding · plaque</th
		>
		{#each archTeeth as code, i (code)}
			{@const t = teeth[index.get(code) ?? -1]}
			{#each sitesOnScreen(code, face) as site, k (site)}
				<td class={mid(i, k)}
					>{#if t}{@render siteMarks(t, site)}{/if}</td
				>
			{/each}
		{/each}
	</tr>
	<tr>
		<th class="pr-2 text-left text-[11px] font-normal text-muted-foreground print:text-[8px]"
			>Pocket</th
		>
		{#each archTeeth as code, i (code)}
			{@const t = teeth[index.get(code) ?? -1]}
			{#each sitesOnScreen(code, face) as site, k (site)}
				{@const was = before?.get(code)}
				<td class="px-px align-top {mid(i, k)}">
					{#if t}
						<input
							class="{box} {depthClass(t.sites[site].depth)} {worse(code, site)
								? 'ring-2 ring-destructive'
								: ''}"
							inputmode="numeric"
							autocomplete="off"
							maxlength="2"
							data-row="{archName}-{face}-depth"
							aria-label="Pocket at {code} {PERIO_SITE_NAMES[site]}"
							value={shown(t.sites[site].depth)}
							{readonly}
							disabled={t.missing}
							oninput={(e) =>
								onNumber(e, PERIO_LIMITS.depth, (n) => {
									editSite(code, site, { depth: n });
									lastTyped = n === null ? null : { code, site };
								})}
							onkeydown={(e) => onKey(e, code, site)}
						/>
						{#if was && !was.missing && was.sites[site].depth !== null}
							<span
								class="block text-center text-[10px] leading-3 text-muted-foreground tabular-nums"
								title="At the last exam"
							>
								{was.sites[site].depth}
							</span>
						{/if}
					{/if}
				</td>
			{/each}
		{/each}
	</tr>
	<tr>
		<th class="pr-2 text-left text-[11px] font-normal text-muted-foreground print:text-[8px]"
			>Recession</th
		>
		{#each archTeeth as code, i (code)}
			{@const t = teeth[index.get(code) ?? -1]}
			{#each sitesOnScreen(code, face) as site, k (site)}
				<td class="px-px {mid(i, k)}">
					{#if t}
						<input
							class={box}
							inputmode="numeric"
							autocomplete="off"
							maxlength="2"
							data-row="{archName}-{face}-recession"
							aria-label="Recession at {code} {PERIO_SITE_NAMES[site]}"
							value={shown(t.sites[site].recession)}
							{readonly}
							disabled={t.missing}
							oninput={(e) =>
								onNumber(e, PERIO_LIMITS.recession, (n) => editSite(code, site, { recession: n }))}
							onkeydown={(e) => onKey(e, code, null)}
						/>
					{/if}
				</td>
			{/each}
		{/each}
	</tr>
{/snippet}

<div class="flex flex-col gap-3">
	{#if !readonly}
		<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={autoAdvance} class="size-4" />
				Move on after each number (untick to type 10 or more)
			</label>
			<span
				>Enter moves along the row · in a pocket box, <kbd>b</kbd> bleeding, <kbd>p</kbd> plaque</span
			>
		</div>
	{/if}

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="overflow-x-auto print:overflow-visible"
		bind:this={grid}
		onpointerdown={() => (lastTyped = null)}
	>
		{#each arches as arch (arch.name)}
			{@const upper = isUpper(arch.teeth[0])}
			<table
				class="mb-4 w-full min-w-[46rem] table-fixed border-separate border-spacing-y-0.5 print:min-w-0"
			>
				<caption class="pb-1 text-left text-sm font-semibold">{arch.name} teeth</caption>
				<colgroup>
					<col class="w-24 print:w-12" />
					{#each SITE_COLUMNS as n (n)}<col />{/each}
				</colgroup>
				<tbody>
					<tr>
						<th
							class="pr-2 text-left text-[11px] font-normal text-muted-foreground print:text-[8px]"
							>Tooth</th
						>
						{#each arch.teeth as code, i (code)}
							{@const t = teeth[index.get(code) ?? -1]}
							<th colspan="3" class="text-center {mid(i)}">
								<button
									type="button"
									class="w-full rounded-sm text-xs font-semibold tabular-nums {t?.missing
										? 'text-muted-foreground line-through'
										: ''} {readonly ? 'cursor-default' : 'hover:bg-muted'}"
									title={readonly ? '' : t?.missing ? 'Mark present' : 'Mark missing'}
									aria-pressed={t?.missing ?? false}
									aria-label="Tooth {code} missing"
									disabled={readonly}
									onclick={() => edit(code, (x) => ({ ...x, missing: !x.missing }))}
								>
									{code}
								</button>
							</th>
						{/each}
					</tr>
					<tr>
						<th
							class="pr-2 text-left text-[11px] font-normal text-muted-foreground print:text-[8px]"
							>Mobility</th
						>
						{#each arch.teeth as code, i (code)}
							{@const t = teeth[index.get(code) ?? -1]}
							<td colspan="3" class="px-1 {mid(i)}">
								{#if t}
									<input
										class={box}
										inputmode="numeric"
										autocomplete="off"
										maxlength="1"
										data-row="{arch.name}-mobility"
										aria-label="Mobility of {code}"
										value={shown(t.mobility)}
										{readonly}
										disabled={t.missing}
										oninput={(e) =>
											onNumber(e, PERIO_LIMITS.mobility, (n) =>
												edit(code, (x) => ({ ...x, mobility: n }))
											)}
										onkeydown={(e) => onKey(e, code, null)}
									/>
								{/if}
							</td>
						{/each}
					</tr>
					<tr>
						<th
							class="pr-2 text-left text-[11px] font-normal text-muted-foreground print:text-[8px]"
							>Furcation</th
						>
						{#each arch.teeth as code, i (code)}
							{@const t = teeth[index.get(code) ?? -1]}
							<td colspan="3" class="px-1 {mid(i)}">
								{#if t && hasFurcation(code)}
									<input
										class={box}
										inputmode="numeric"
										autocomplete="off"
										maxlength="1"
										data-row="{arch.name}-furcation"
										aria-label="Furcation of {code}"
										value={shown(t.furcation)}
										{readonly}
										disabled={t.missing}
										oninput={(e) =>
											onNumber(e, PERIO_LIMITS.furcation, (n) =>
												edit(code, (x) => ({ ...x, furcation: n }))
											)}
										onkeydown={(e) => onKey(e, code, null)}
									/>
								{/if}
							</td>
						{/each}
					</tr>
					{@render faceRows(arch.teeth, 'buccal', upper, arch.name)}
					{@render faceRows(arch.teeth, 'lingual', upper, arch.name)}
				</tbody>
			</table>
		{/each}
	</div>

	<p class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
		<span class="flex items-center gap-1">
			<span class="size-2.5 rounded-full bg-destructive"></span> bleeding
		</span>
		<span class="flex items-center gap-1"
			><span class="size-2.5 rounded-full bg-primary"></span> plaque</span
		>
		<span
			><span class="font-semibold text-amber-600 dark:text-amber-400">{DEEP}+</span> mm pocket</span
		>
		<span><span class="font-bold text-destructive">{VERY_DEEP}+</span> mm pocket</span>
		{#if previous}
			<span>small number: the last exam’s pocket</span>
			<span class="flex items-center gap-1">
				<span class="size-3 rounded-sm ring-2 ring-destructive"></span>
				{WORSE_BY}+ mm attachment lost since then
			</span>
		{/if}
		<span>a struck-through tooth is missing</span>
	</p>
</div>
