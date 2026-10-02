<script lang="ts">
	import PrintSheet from '@nahu/admin-kit/components/PrintSheet.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { MESSAGES } from '$lib/i18n/messages';

	/**
	 * A consent form to sign, in the language chosen when printing — Amharic or English, whatever
	 * the screen is in. The wording is the clinic's; the frame and the signature lines are here.
	 * Each signature has room to write a name beside it, because a thumbprint is a signature too.
	 */
	let { data } = $props();

	const f = $derived(MESSAGES[data.lang].forms);
	const paragraphs = $derived(data.body.split(/\n\s*\n/));
</script>

<svelte:head>
	<title>{f.consent.title(f.consent.types[data.consentType])} — {data.patient.fullName}</title>
</svelte:head>

<PrintSheet branch={data.branch} fallbackName="Dental clinic">
	<section class="flex flex-col gap-2" lang={data.lang}>
		<p class="text-xl font-semibold">{f.consent.title(f.consent.types[data.consentType])}</p>
		<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
			<dt class="text-muted-foreground">{f.patient}</dt>
			<dd>{data.patient.fullName}</dd>
			{#if data.patient.fileNo}
				<dt class="text-muted-foreground">{f.fileNo}</dt>
				<dd>{data.patient.fileNo}</dd>
			{/if}
			<dt class="text-muted-foreground">{f.date}</dt>
			<dd>{formatEthiopianDate(new Date(data.printedOn))}</dd>
		</dl>
	</section>

	<section class="flex flex-col gap-3 text-[15px] leading-relaxed" lang={data.lang}>
		{#each paragraphs as paragraph, i (i)}
			<p class="whitespace-pre-line">{paragraph}</p>
		{/each}
	</section>

	<section
		class="mt-4 grid grid-cols-1 gap-x-10 gap-y-8 text-sm sm:grid-cols-2 print:grid-cols-2"
		lang={data.lang}
	>
		{#snippet line(label: string, filled: string | null = null)}
			<div class="flex flex-col gap-1">
				<div class="flex h-10 items-end border-b border-foreground/60 pb-1">{filled ?? ''}</div>
				<span class="text-xs text-muted-foreground">{label}</span>
			</div>
		{/snippet}
		{@render line(f.consent.patientSigns)}
		{@render line(f.date)}
		<div class="sm:col-span-2 print:col-span-2">{@render line(f.consent.guardianSigns)}</div>
		{@render line(f.consent.relationship)}
		{@render line(f.date)}
		{@render line(f.consent.witness)}
		{@render line(f.consent.clinicianSigns, data.clinician)}
	</section>
</PrintSheet>
