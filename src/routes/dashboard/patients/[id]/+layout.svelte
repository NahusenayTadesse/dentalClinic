<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import MapPinned from '@lucide/svelte/icons/map-pinned';
	import GitMerge from '@lucide/svelte/icons/git-merge';
	import { page } from '$app/state';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';

	/**
	 * What stays on screen whichever tab of the chart is open: who the patient is, the alerts to
	 * read before touching them, and the tabs.
	 *
	 * The alerts are here rather than on the overview so they are in front of whoever is charting a
	 * tooth or writing a prescription — the moments an allergy matters.
	 */
	let { data, children } = $props();

	const p = $derived(data.patient);

	const ageText = $derived(
		p.age === null ? 'Age not recorded' : `${p.birthDateEstimated ? 'About ' : ''}${p.age} years`
	);

	const severeAllergies = $derived(data.flags.allergies.filter((a) => a.severity === 'severe'));
	const otherAllergies = $derived(data.flags.allergies.filter((a) => a.severity !== 'severe'));

	const base = $derived(`/dashboard/patients/${p.id}`);
	const tabs = $derived([
		{ label: 'Overview', href: base },
		{ label: 'Dental chart', href: `${base}/chart` },
		{ label: 'Treatment plans', href: `${base}/plans` },
		{ label: 'Notes', href: `${base}/notes` },
		{ label: 'Prescriptions', href: `${base}/prescriptions` },
		{ label: 'Files', href: `${base}/files` },
		{ label: 'Consents', href: `${base}/consents` },
		{ label: 'Lab work', href: `${base}/lab` },
		// Money is not every chart reader's to see: the tab is there only for `billing.invoice`.
		...(data.can.bill ? [{ label: 'Billing', href: `${base}/billing` }] : []),
		// Who has looked is the audit trail's question, not the chart's: `audit_logs.view` only.
		...(data.can.seeViews ? [{ label: 'Access log', href: `${base}/access` }] : [])
	]);

	/** The overview is current on its own path only; every other tab also on the pages below it. */
	function isCurrent(href: string) {
		const path = page.url.pathname;
		return href === base ? path === base : path === href || path.startsWith(`${href}/`);
	}
</script>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<!-- ── Who this is ─────────────────────────────────────────────────────────── -->
	<header class="flex flex-col gap-2">
		<div class="flex flex-wrap items-center gap-3">
			<h1 class="text-3xl font-extrabold tracking-tight">{p.fullName}</h1>
			<Badge variant="secondary">{p.fileNo ? `File ${p.fileNo}` : 'No file number'}</Badge>
			<Badge variant="outline">{p.sex === 'female' ? 'Female' : 'Male'} · {ageText}</Badge>
			{#if p.bloodType}<Badge variant="outline">Blood {p.bloodType}</Badge>{/if}
			{#if data.balance}
				<a href="{base}/billing">
					<Badge variant="destructive">Owes {formatETB(data.balance)}</Badge>
				</a>
			{/if}
		</div>

		{#if data.fromOtherBranch}
			<!-- The wording CLAUDE.md §15 asks for, where the receptionist is looking. -->
			<p
				class="flex items-center gap-2 rounded-md border border-amber-500 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
			>
				<MapPinned class="size-4" />
				This patient is not from this branch ({p.branch ?? 'registered elsewhere'}), but can be
				treated here.
			</p>
		{/if}

		{#if data.mergedFrom}
			<p class="flex items-center gap-2 rounded-md border p-3 text-muted-foreground">
				<GitMerge class="size-4" />
				You followed a record that was merged into this one. This is the patient’s current chart.
			</p>
		{/if}
	</header>

	<!-- ── Before you touch the patient ───────────────────────────────────────── -->
	{#if severeAllergies.length || data.flags.medicineAlerts.length || otherAllergies.length || p.historyState !== 'current'}
		<section
			role="alert"
			class="flex flex-col gap-2 rounded-2xl border-2 border-destructive/60 bg-destructive/5 p-4"
		>
			<!-- Not an <h2>: the global heading style renders it in display type, several times too big. -->
			<p class="flex items-center gap-2 text-lg font-bold text-destructive">
				<TriangleAlert class="size-5" /> Medical alerts
			</p>
			<div class="flex flex-wrap gap-2">
				{#each severeAllergies as allergy (allergy.name)}
					<Badge variant="destructive">Severe allergy: {allergy.name}</Badge>
				{/each}
				{#each data.flags.medicineAlerts as alert (alert)}
					<Badge class="bg-amber-500 text-white">{alert}</Badge>
				{/each}
				{#each otherAllergies as allergy (allergy.name)}
					<Badge variant="outline" class="border-red-400 text-red-700 dark:text-red-300">
						Allergy: {allergy.name}
					</Badge>
				{/each}
			</div>
			{#if p.historyState === 'never'}
				<!-- The difference between "nothing reported" and "nobody asked" (see the schema). -->
				<p class="text-sm">
					<strong>No medical history has been taken.</strong> An empty allergy list here means nobody
					has asked yet — not that there are none.
				</p>
			{:else if p.historyState === 'stale'}
				<p class="text-sm">
					The medical history is over a year old (taken {p.historyTakenAt
						? formatEthiopianDate(new Date(p.historyTakenAt))
						: '—'}). Ask again before treatment.
				</p>
			{/if}
		</section>
	{/if}

	<nav class="flex gap-1 overflow-x-auto border-b" aria-label="Patient record">
		{#each tabs as tab (tab.href)}
			{@const current = isCurrent(tab.href)}
			<a
				href={tab.href}
				aria-current={current ? 'page' : undefined}
				class="-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium {current
					? 'border-primary text-foreground'
					: 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				{tab.label}
			</a>
		{/each}
	</nav>

	{@render children()}
</div>
