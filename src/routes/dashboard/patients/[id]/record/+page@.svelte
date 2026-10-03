<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { VIEWED_RECORD_LABEL, VIEW_ACTION_LABEL } from '$lib/accessLog';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { ethiopianDateTime } from '$lib/tableCells';
	import { whereLabel } from '$lib/teeth';
	import { APPLIANCE_LABEL } from '$lib/orthoPlan';

	/**
	 * A patient's whole record, for them to keep: one section a part of the chart, each a plain
	 * list. The file version (above the sheet) carries the same content for another clinic's system.
	 */
	let { data } = $props();

	const r = $derived(data.record);
	const day = (value: string | Date | null | undefined) =>
		value
			? formatEthiopianDate(
					new Date(typeof value === 'string' && value.length === 10 ? `${value}T12:00:00Z` : value)
				)
			: '—';
</script>

<svelte:head>
	<title>Record of {r.person.fullName}</title>
</svelte:head>

<div class="mx-auto flex max-w-3xl justify-end px-8 pt-6 print:hidden">
	<Button variant="outline" href="/dashboard/patients/{data.patientId}/record/json" download>
		<Download class="size-4" /> As a file (JSON)
	</Button>
</div>

{#snippet heading(text: string)}
	<p class="mt-2 break-after-avoid border-b pb-1 font-semibold">{text}</p>
{/snippet}

<PrintSheet branch={data.branch} fallbackName="Dental clinic">
	<section class="flex flex-col gap-1 text-sm">
		<p class="text-xl font-semibold">Patient record — copy for the patient</p>
		<p>
			{r.person.fullName}{r.person.fileNo ? ` · File ${r.person.fileNo}` : ''} · given {day(
				data.printedOn
			)}
		</p>
	</section>

	<section class="flex flex-col gap-1 text-sm">
		{@render heading('Who you are')}
		<p>
			Sex: {r.person.sex} · Born: {day(r.person.birthDate)} · Blood type: {r.person.bloodType ??
				'—'}
		</p>
		<p>Phone: {r.person.phone ?? '—'}{r.person.altPhone ? `, ${r.person.altPhone}` : ''}</p>
		{#if r.person.payer}<p>
				Paid for by: {r.person.payer}{r.person.payerMemberNo
					? ` (member ${r.person.payerMemberNo})`
					: ''}
			</p>{/if}
		<p>Registered: {day(r.person.registeredOn)}</p>
	</section>

	<section class="flex flex-col gap-1 text-sm">
		{@render heading('Medical history')}
		<p>Allergies: {r.history.allergies.join(', ') || 'none recorded'}</p>
		<p>Conditions: {r.history.conditions.join(', ') || 'none recorded'}</p>
		<p>Medicines: {r.history.medicines.join(', ') || 'none recorded'}</p>
		{#if r.person.medicalNotes}<p class="whitespace-pre-line">{r.person.medicalNotes}</p>{/if}
	</section>

	<section class="flex flex-col gap-1 text-sm">
		{@render heading(`Appointments (${r.appointments.length})`)}
		{#each r.appointments as a, i (i)}
			<p>{ethiopianDateTime(a.startsAt)} · {a.status}{a.provider ? ` · ${a.provider}` : ''}</p>
		{:else}<p>None.</p>{/each}
	</section>

	<section class="flex flex-col gap-1 text-sm">
		{@render heading(`Dental chart (${r.chart.length})`)}
		{#each r.chart as p, i (i)}
			<p>
				{p.service ?? 'Procedure'} · {whereLabel(p)} · {p.status}{p.completedOn
					? ` · done ${day(p.completedOn)}`
					: ''}{p.provider ? ` · ${p.provider}` : ''}
			</p>
		{:else}<p>None.</p>{/each}
	</section>

	{#if r.perio.length}
		<section class="flex flex-col gap-1 text-sm">
			{@render heading('Gum examinations')}
			{#each r.perio as e, i (i)}
				<p>
					{day(e.examinedOn)} · {e.summary.sitesMeasured} sites · pockets 4 mm+: {e.summary.deep} · bleeding
					{e.summary.bleedingPercent ?? '—'}%
				</p>
			{/each}
		</section>
	{/if}

	{#if r.ortho.length}
		<section class="flex flex-col gap-1 text-sm">
			{@render heading('Orthodontic treatment')}
			{#each r.ortho as c, i (i)}
				<p>
					{APPLIANCE_LABEL[c.appliance]} · from {day(c.startedOn)}{c.endedOn
						? ` to ${day(c.endedOn)}`
						: ''} · {c.status} · fee {formatETB(c.totalFee)}, paid {formatETB(c.paid)}
				</p>
			{/each}
		</section>
	{/if}

	<section class="flex flex-col gap-1 text-sm">
		{@render heading(`Clinical notes (${r.notes.length})`)}
		{#each r.notes as n, i (i)}
			<div class="break-inside-avoid">
				<p class="font-medium">{day(n.signedAt)} · {n.kind}{n.summary ? ` · ${n.summary}` : ''}</p>
				<p class="whitespace-pre-line">{n.body}</p>
			</div>
		{:else}<p>None.</p>{/each}
	</section>

	<section class="flex flex-col gap-1 text-sm">
		{@render heading(`Prescriptions (${r.prescriptions.length})`)}
		{#each r.prescriptions as p, i (i)}
			<p>
				{day(p.prescribedOn)} · {p.medicines} · {p.provider}{p.indication
					? ` · ${p.indication}`
					: ''}
			</p>
		{:else}<p>None.</p>{/each}
	</section>

	<section class="flex flex-col gap-1 text-sm">
		{@render heading(`Consents (${r.consents.length})`)}
		{#each r.consents as c, i (i)}
			<p>
				{c.consentType} · {c.method} · {day(c.givenOn)}{c.withdrawnOn
					? ` · withdrawn ${day(c.withdrawnOn)}`
					: ''}
			</p>
		{:else}<p>None.</p>{/each}
	</section>

	<section class="flex flex-col gap-1 text-sm">
		{@render heading(`Files held (${r.files.length})`)}
		{#each r.files as f, i (i)}
			<p>{f.kind} · {f.description ?? f.originalName ?? 'file'} · added {day(f.addedOn)}</p>
		{:else}<p>None.</p>{/each}
	</section>

	<section class="flex flex-col gap-1 text-sm">
		{@render heading(`Bills (${r.bills.length})`)}
		{#each r.bills as b, i (i)}
			<p>
				{b.number ?? 'Draft'} · {day(b.issuedOn)} · {formatETB(b.total)} · {b.owed > 0
					? `owes ${formatETB(b.owed)}`
					: 'paid'}
			</p>
		{:else}<p>None.</p>{/each}
		{#each r.deposits as d, i (i)}
			<p>Deposit {d.receiptNumber ?? ''} · {formatETB(d.amount)} · {formatETB(d.left)} left</p>
		{/each}
	</section>

	<section class="flex flex-col gap-1 text-sm">
		{@render heading('Who has opened your record')}
		{#each r.access as a, i (i)}
			<p>
				{ethiopianDateTime(a.at)} · {a.by ?? 'unknown'} · {VIEW_ACTION_LABEL[a.action] ?? a.action}
				{VIEWED_RECORD_LABEL[a.recordType] ?? a.recordType}
			</p>
		{:else}<p>No one yet.</p>{/each}
	</section>
</PrintSheet>
