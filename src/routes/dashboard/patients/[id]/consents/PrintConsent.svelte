<script lang="ts">
	import Printer from '@lucide/svelte/icons/printer';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import * as Select from '@nahu/admin-kit/components/ui/select/index.js';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import type { Lang } from '$lib/i18n/lang';
	import { forms } from '$lib/i18n/messages/en/forms';

	/**
	 * Printing a consent form for the patient to sign: which form, for which treatment, explained by
	 * whom, and in which language. Nothing is saved — the printout opens in a new tab, and the signed
	 * sheet is recorded on this tab afterwards, as any consent is.
	 */
	let {
		base,
		printable,
		treatments,
		clinicians,
		lang
	}: {
		/** The patient's consents tab. */
		base: string;
		printable: { id: number; name: string; consentType: keyof typeof forms.consent.types }[];
		treatments: { value: number; name: string }[];
		clinicians: { value: number; name: string }[];
		lang: Lang;
	} = $props();

	let open = $state(false);
	// svelte-ignore state_referenced_locally
	let form = $state({
		template: String(printable[0]?.id ?? ''),
		treatment: '',
		clinician: '',
		lang
	});

	const NONE = '';
	const nameOf = (list: { value: number | string; name: string }[], value: string, empty: string) =>
		list.find((o) => String(o.value) === value)?.name ?? empty;

	const templates = $derived(
		printable.map((t) => ({
			value: t.id,
			name: `${t.name} · ${forms.consent.types[t.consentType]}`
		}))
	);
	const href = $derived(
		`${base}/print?` +
			Object.entries(form)
				.filter(([, value]) => value !== '')
				.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
				.join('&')
	);
</script>

{#snippet choice(
	label: string,
	value: string,
	items: { value: number | string; name: string }[],
	empty: string | null,
	set: (v: string) => void
)}
	<div class="flex flex-col gap-1.5">
		<span class="text-sm font-medium">{label}</span>
		<Select.Root type="single" {value} onValueChange={set}>
			<Select.Trigger class="w-full" aria-label={label}>
				<span class="truncate">{nameOf(items, value, empty ?? '—')}</span>
			</Select.Trigger>
			<Select.Content>
				{#if empty !== null}<Select.Item value={NONE}>{empty}</Select.Item>{/if}
				{#each items as item (item.value)}
					<Select.Item value={String(item.value)}>{item.name}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
{/snippet}

<DialogComp
	title="Print a consent form"
	description="For the patient to read and sign. Record the signed form on this tab afterwards."
	variant="outline"
	IconComp={Printer}
	bind:open
>
	<div class="flex flex-col gap-4 p-4">
		{#if !printable.length}
			<p class="text-sm text-muted-foreground">
				No consent forms are set up. Add one under <strong>Clinic Setup → Consent Forms</strong>.
			</p>
		{:else}
			{@render choice('Form', form.template, templates, null, (v) => (form.template = v))}
			{@render choice(
				'For the treatment',
				form.treatment,
				treatments,
				'Write it on the paper',
				(v) => (form.treatment = v)
			)}
			{@render choice(
				'Explained by',
				form.clinician,
				clinicians,
				'Write it on the paper',
				(v) => (form.clinician = v)
			)}
			{@render choice(
				'Language',
				form.lang,
				[
					{ value: 'am', name: 'አማርኛ' },
					{ value: 'en', name: 'English' }
				],
				null,
				(v) => (form.lang = v === 'en' ? 'en' : 'am')
			)}
			<Button {href} target="_blank" onclick={() => (open = false)} disabled={!form.template}>
				<Printer class="size-4" /> Print
			</Button>
		{/if}
	</div>
</DialogComp>
