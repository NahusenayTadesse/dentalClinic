<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import MapPinned from '@lucide/svelte/icons/map-pinned';
	import GitMerge from '@lucide/svelte/icons/git-merge';
	import { page } from '$app/state';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	/**
	 * What stays on screen whichever tab of the chart is open: who the patient is, the alerts to
	 * read before touching them, and the tabs.
	 *
	 * The alerts are here rather than on the overview so they are in front of whoever is charting a
	 * tooth or writing a prescription — the moments an allergy matters.
	 */
	let { data, children } = $props();

	const t = useI18n();
	const pm = $derived(t.m.patients);
	const c = $derived(pm.chart);

	const p = $derived(data.patient);

	const ageText = $derived(
		p.age === null ? c.ageNotRecorded : c.ageYears(p.age, p.birthDateEstimated)
	);

	const severeAllergies = $derived(data.flags.allergies.filter((a) => a.severity === 'severe'));
	const otherAllergies = $derived(data.flags.allergies.filter((a) => a.severity !== 'severe'));

	const base = $derived(`/dashboard/patients/${p.id}`);
	const tabs = $derived([
		{ label: c.tabs.overview, href: base },
		{ label: c.tabs.chart, href: `${base}/chart` },
		{ label: c.tabs.perio, href: `${base}/perio` },
		{ label: c.tabs.plans, href: `${base}/plans` },
		{ label: c.tabs.notes, href: `${base}/notes` },
		{ label: c.tabs.prescriptions, href: `${base}/prescriptions` },
		{ label: c.tabs.files, href: `${base}/files` },
		{ label: c.tabs.consents, href: `${base}/consents` },
		{ label: c.tabs.lab, href: `${base}/lab` },
		// Money is not every chart reader's to see: the tab is there only for `billing.invoice`.
		...(data.can.bill ? [{ label: c.tabs.billing, href: `${base}/billing` }] : []),
		// Who has looked is the audit trail's question, not the chart's: `audit_logs.view` only.
		...(data.can.seeViews ? [{ label: c.tabs.access, href: `${base}/access` }] : [])
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
			<Badge variant="secondary">{p.fileNo ? pm.file(p.fileNo) : pm.noFileNumber}</Badge>
			<Badge variant="outline">{pm.sex[p.sex]} · {ageText}</Badge>
			{#if p.bloodType}<Badge variant="outline">{c.blood(p.bloodType)}</Badge>{/if}
			{#if data.balance}
				<a href="{base}/billing">
					<Badge variant="destructive">{c.owes(formatETB(data.balance))}</Badge>
				</a>
			{/if}
		</div>

		{#if data.fromOtherBranch}
			<!-- The wording CLAUDE.md §15 asks for, where the receptionist is looking. -->
			<p
				class="flex items-center gap-2 rounded-md border border-amber-500 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
			>
				<MapPinned class="size-4" />
				{c.notFromHere(p.branch ?? c.registeredElsewhere)}
			</p>
		{/if}

		{#if data.mergedFrom}
			<p class="flex items-center gap-2 rounded-md border p-3 text-muted-foreground">
				<GitMerge class="size-4" />
				{c.mergedFrom}
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
				<TriangleAlert class="size-5" />
				{c.medicalAlerts}
			</p>
			<div class="flex flex-wrap gap-2">
				{#each severeAllergies as allergy (allergy.name)}
					<Badge variant="destructive">{c.severeAllergy(allergy.name)}</Badge>
				{/each}
				{#each data.flags.medicineAlerts as alert (alert)}
					<Badge class="bg-amber-500 text-white">{alert}</Badge>
				{/each}
				{#each otherAllergies as allergy (allergy.name)}
					<Badge variant="outline" class="border-red-400 text-red-700 dark:text-red-300">
						{c.allergy(allergy.name)}
					</Badge>
				{/each}
			</div>
			{#if p.historyState === 'never'}
				<!-- The difference between "nothing reported" and "nobody asked" (see the schema). -->
				<p class="text-sm">
					<strong>{c.noHistory}</strong>
					{c.noHistoryWhy}
				</p>
			{:else if p.historyState === 'stale'}
				<p class="text-sm">
					{c.staleHistory(p.historyTakenAt ? formatEthiopianDate(new Date(p.historyTakenAt)) : '—')}
				</p>
			{/if}
		</section>
	{/if}

	<nav class="flex gap-1 overflow-x-auto border-b" aria-label={c.record}>
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
