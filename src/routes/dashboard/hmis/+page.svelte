<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Download from '@lucide/svelte/icons/download';
	import Printer from '@lucide/svelte/icons/printer';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Users from '@lucide/svelte/icons/users';
	import Stethoscope from '@lucide/svelte/icons/stethoscope';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import MonthYear from '@nahu/admin-kit/formComponents/MonthYear.svelte';
	import { canVisit } from '$lib/routeAccess';
	import { viewer } from '$lib/viewer.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { HMIS_BAND_KEYS, bandLabel, tallyTotals, type Tally } from '$lib/hmisReport';
	import TallyTable from './TallyTable.svelte';

	/**
	 * The monthly return to the health office: visits and diagnoses for one Ethiopian month at the
	 * branch chosen in the top bar. What cannot be counted yet is listed first, with where to fix it,
	 * so a return is not filed short without anyone knowing.
	 */
	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let month = $state(data.month);
	const who = viewer();
	const can = (path: string) => canVisit(path, who.permList);

	const report = $derived(data.report);
	const day = (iso: string) => formatEthiopianDate(new Date(`${iso}T12:00:00Z`));
	/** "1 visit", "3 visits". */
	const count = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;
	const query = $derived(`?month=${encodeURIComponent(data.month)}`);

	const visitRows = $derived(
		report
			? [
					{ label: 'New', tally: report.visits.new },
					{ label: 'Repeat', tally: report.visits.repeat }
				]
			: []
	);
	const caseRows = $derived(
		report?.cases.map((c) => ({ code: c.hmisCode, label: c.name, tally: c.tally })) ?? []
	);
	const uncounted = $derived(report?.uncounted);
	const anythingUncounted = $derived(
		Boolean(
			uncounted &&
			(uncounted.unlinkedFindings.length ||
				uncounted.uncoded.length ||
				uncounted.unknownAge.visits ||
				uncounted.unknownAge.cases)
		)
	);

	/**
	 * One CSV field: always quoted, quotes doubled, and a leading `= + - @` defused so a diagnosis
	 * name cannot run as a spreadsheet formula.
	 */
	const field = (value: string | number) => {
		const text = String(value);
		return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
	};

	/** The return as a spreadsheet: one row per line, a male and a female column per age group. */
	function download() {
		if (!report) return;
		const header = [
			'Section',
			'Code',
			'Line',
			...HMIS_BAND_KEYS.flatMap((k) => [`${bandLabel(k)} M`, `${bandLabel(k)} F`]),
			'Total M',
			'Total F',
			'Total'
		];
		const line = (section: string, code: string, label: string, tally: Tally) => {
			const sums = tallyTotals(tally);
			return [
				section,
				code,
				label,
				...HMIS_BAND_KEYS.flatMap((k) => [tally[k].male, tally[k].female]),
				sums.male,
				sums.female,
				sums.all
			];
		};
		const rows = [
			header,
			...visitRows.map((r) => line('Visits', '', r.label, r.tally)),
			...caseRows.map((r) => line('Diagnoses', r.code, r.label, r.tally))
		];
		const csv = rows.map((row) => row.map(field).join(',')).join('\r\n');
		const link = document.createElement('a');
		// The byte-order mark is what makes Excel read the Amharic as UTF-8.
		link.href = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
		link.download = `hmis-${report.facility.name ?? 'facility'}-${data.month}.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
	}
</script>

<svelte:head>
	<title>Monthly Health Report</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-3xl font-extrabold tracking-tight">Monthly Health Report</h1>
			<p class="text-muted-foreground">
				Visits and diagnoses for the health office (HMIS), for one month at this branch
				{#if report}
					· {report.facility.name} · {day(data.period.start)} – {day(data.period.end)}
				{/if}
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<MonthYear bind:value={month} />
			<Button variant="outline" href="?month={encodeURIComponent(month)}">
				Go <ArrowRight class="size-4" />
			</Button>
			{#if report}
				<Button variant="outline" onclick={download}><Download class="size-4" /> Download</Button>
				<Button href="/dashboard/hmis/print{query}" target="_blank">
					<Printer class="size-4" /> Print
				</Button>
			{/if}
		</div>
	</header>

	{#if data.needsBranch}
		<p class="rounded-md border p-4 text-sm text-muted-foreground">
			Choose a branch in the top bar. Each branch is a facility and files its own return.
		</p>
	{:else if !report}
		<p class="rounded-md border p-4 text-sm text-muted-foreground">That branch no longer exists.</p>
	{:else}
		{#if anythingUncounted && uncounted}
			<section
				class="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm"
				aria-label="Not counted yet"
			>
				<p class="flex items-center gap-2 font-semibold text-destructive">
					<TriangleAlert class="size-4" /> Not everything this month can be counted yet
				</p>
				{#if uncounted.uncoded.length}
					<div>
						<p>
							These diagnoses have no Ministry (HMIS) code, so they are left out of the diagnoses
							table:
						</p>
						<ul class="mt-1 list-disc pl-5">
							{#each uncounted.uncoded as c (c.conditionId)}
								<li>{c.name} — {count(c.cases, 'case')}</li>
							{/each}
						</ul>
						<p class="mt-1 text-muted-foreground">
							Give each its code from the national classification under
							{#if can('/dashboard/admin-panel/conditions')}
								<a class="underline" href="/dashboard/admin-panel/conditions"
									>Clinic Setup → Conditions</a
								>.
							{:else}
								Clinic Setup → Conditions.
							{/if}
						</p>
					</div>
				{/if}
				{#if uncounted.unlinkedFindings.length}
					<div>
						<p>
							These findings were charted, but their service says nothing about what was diagnosed:
						</p>
						<ul class="mt-1 list-disc pl-5">
							{#each uncounted.unlinkedFindings as f (f.serviceId)}
								<li>{f.name} — {count(f.findings, 'finding')}</li>
							{/each}
						</ul>
						<p class="mt-1 text-muted-foreground">
							Set its <em>Diagnosis (as a finding)</em> under
							{#if can('/dashboard/admin-panel/services')}
								<a class="underline" href="/dashboard/admin-panel/services"
									>Clinic Setup → Services</a
								>.
							{:else}
								Clinic Setup → Services.
							{/if}
						</p>
					</div>
				{/if}
				{#if uncounted.unknownAge.visits || uncounted.unknownAge.cases}
					<p>
						Counted under <em>Age unknown</em> because the patient has no birth date:
						{count(uncounted.unknownAge.visits, 'visit')} and {count(
							uncounted.unknownAge.cases,
							'case'
						)}. An estimated age on the patient's record is enough.
					</p>
				{/if}
			</section>
		{/if}

		<Section title="Outpatient visits" IconComp={Users} style="identityIcon">
			<TallyTable rows={visitRows} labelHeader="Visit" withTotal />
			<p class="mt-2 text-xs text-muted-foreground">
				Completed visits only. <em>New</em> is the patient's first completed visit at this branch;
				every later one is <em>repeat</em>.
			</p>
		</Section>

		<Section title="Diagnoses" IconComp={Stethoscope} style="identityIcon">
			{#if caseRows.length}
				<TallyTable rows={caseRows} labelHeader="Diagnosis" codeHeader="Code" withTotal />
			{:else}
				<p class="text-sm text-muted-foreground">No coded diagnoses this month.</p>
			{/if}
			<p class="mt-2 text-xs text-muted-foreground">
				One case per patient per diagnosis in the month: findings charted on the dental chart, and
				dental conditions with a diagnosis date on a day the patient was seen here. Suspected
				conditions, and medical history the clinic does not diagnose, are not counted. Age is on the
				day of diagnosis. Check the age groups against the current form from your health office.
			</p>
		</Section>
	{/if}
</div>
