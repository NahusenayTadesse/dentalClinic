<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { MESSAGES } from '$lib/i18n/messages';

	/**
	 * The medical-history questionnaire, in the language chosen when printing. Each question has a
	 * yes and a no box and a line for details; what the chart already holds is printed below for the
	 * patient to correct. The pregnancy question is printed for women only.
	 */
	let { data } = $props();

	const f = $derived(MESSAGES[data.lang].forms);
	const h = $derived(f.history);
	const questions = $derived(
		Object.entries(h.questions).filter(
			([key]) => key !== 'pregnant' || data.patient.sex === 'female'
		)
	);
	const day = (iso: string) => formatEthiopianDate(new Date(iso));
</script>

<svelte:head>
	<title>{h.title} — {data.patient.fullName}</title>
</svelte:head>

{#snippet onRecord(label: string, items: string[])}
	<div class="flex flex-col gap-1">
		<span class="text-xs font-semibold">{label}</span>
		<span class="min-h-8 border-b border-foreground/40 pb-1">
			{items.length ? items.join(', ') : h.none}
		</span>
	</div>
{/snippet}

<PrintSheet branch={data.branch} fallbackName="Dental clinic">
	<section class="flex flex-col gap-2" lang={data.lang}>
		<p class="text-xl font-semibold">{h.title}</p>
		<dl class="grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-muted-foreground">{f.patient}</dt>
			<dd>{data.patient.fullName}</dd>
			<dt class="text-muted-foreground">{f.fileNo}</dt>
			<dd>{data.patient.fileNo ?? '—'}</dd>
			<dt class="text-muted-foreground">{f.dateOfBirth}</dt>
			<dd>{data.patient.birthDate ? day(data.patient.birthDate) : '__________'}</dd>
			<dt class="text-muted-foreground">{f.phone}</dt>
			<dd>{data.patient.phone ?? '__________'}</dd>
		</dl>
		<p class="text-sm">{h.intro}</p>
	</section>

	<table class="w-full border-collapse text-sm" lang={data.lang}>
		<thead>
			<tr class="border-b text-left text-xs text-muted-foreground">
				<th class="py-1 font-normal"></th>
				<th class="w-12 py-1 text-center font-normal">{h.yes}</th>
				<th class="w-12 py-1 text-center font-normal">{h.no}</th>
				<th class="w-2/5 py-1 font-normal">{h.details}</th>
			</tr>
		</thead>
		<tbody>
			{#each questions as [key, text], i (key)}
				<tr class="break-inside-avoid border-b">
					<td class="py-2 pr-2">{i + 1}. {text}</td>
					<td class="text-center"
						><span class="inline-block size-4 border border-foreground"></span></td
					>
					<td class="text-center"
						><span class="inline-block size-4 border border-foreground"></span></td
					>
					<td></td>
				</tr>
			{/each}
		</tbody>
	</table>

	<section class="flex break-inside-avoid flex-col gap-3 text-sm" lang={data.lang}>
		<p class="font-semibold">{h.onRecord}</p>
		{@render onRecord(h.allergies, data.history.allergies)}
		{@render onRecord(h.conditions, data.history.conditions)}
		{@render onRecord(h.medications, data.history.medicines)}
		<div class="flex flex-col gap-1">
			<span class="text-xs font-semibold">{h.otherMedicines}</span>
			<span class="h-8 border-b border-foreground/40"></span>
		</div>
	</section>

	<section class="flex break-inside-avoid flex-col gap-6 text-sm" lang={data.lang}>
		<p>{h.declaration}</p>
		<div class="grid grid-cols-2 gap-x-10">
			<div class="flex flex-col gap-1">
				<div class="h-10 border-b border-foreground/60"></div>
				<span class="text-xs text-muted-foreground">{f.consent.patientSigns}</span>
			</div>
			<div class="flex flex-col gap-1">
				<div class="flex h-10 items-end border-b border-foreground/60 pb-1">
					{day(data.printedOn)}
				</div>
				<span class="text-xs text-muted-foreground">{f.date}</span>
			</div>
		</div>
	</section>
</PrintSheet>
