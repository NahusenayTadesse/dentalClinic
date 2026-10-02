<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import Save from '@lucide/svelte/icons/save';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { formatETB } from '$lib/global.svelte';
	import { SMS_PLACEHOLDERS, fillTemplate, smsSegments } from '$lib/smsTemplates';
	import { templates, type Templates } from './schema';

	/**
	 * What a reminder and a recall say, with each shown filled in for a sample patient and what it
	 * will cost — by the same rule the sender logs by (`$lib/smsTemplates.ts`), so the preview is
	 * the bill.
	 */
	let { data, costPerSegment }: { data: SuperValidated<Templates>; costPerSegment: number | null } =
		$props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data, templates);

	const SAMPLE = {
		name: 'ሐና',
		date: '25 መስከረም 2019',
		time: 'ጠዋት 3:00',
		clinic: 'ዋና ቅርንጫፍ',
		phone: '0911000000',
		visit: 'ምርመራ'
	};

	const previews = $derived(
		(['reminder', 'recall'] as const).map((kind) => {
			const text = fillTemplate(String($form[kind] ?? ''), SAMPLE);
			const { segments, encoding } = smsSegments(text);
			return { kind, text, segments, encoding };
		})
	);
</script>

<form method="post" action="?/saveTemplates" use:enhance class="flex flex-col gap-4">
	<Errors allErrors={$allErrors} />
	<p class="text-sm text-muted-foreground">
		Placeholders:
		{#each Object.entries(SMS_PLACEHOLDERS) as [key, meaning] (key)}
			<code class="mr-2 rounded bg-muted px-1" title={meaning}>{`{${key}}`}</code>
		{/each}
	</p>
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		{#each previews as preview (preview.kind)}
			<div class="flex flex-col gap-2">
				<InputComp
					{form}
					{errors}
					name={preview.kind}
					label={preview.kind === 'reminder' ? 'Appointment reminder' : 'Recall'}
					type="textarea"
					rows={4}
				/>
				<div class="rounded-md border bg-muted/40 p-3 text-sm">
					<p class="whitespace-pre-wrap">{preview.text}</p>
					<p class="mt-2 text-xs text-muted-foreground">
						{preview.text.length} characters ·
						{preview.segments}
						{preview.segments === 1 ? 'segment' : 'segments'}
						({preview.encoding === 'ucs2' ? 'Amharic: 70 a segment' : 'Latin: 160 a segment'})
						{#if costPerSegment !== null}· about {formatETB(preview.segments * costPerSegment)} each{/if}
					</p>
				</div>
			</div>
		{/each}
	</div>
	<Button type="submit" class="self-start" disabled={$delayed}>
		{#if $delayed}<LoadingBtn name="Saving" />{:else}<Save class="size-4" /> Save messages{/if}
	</Button>
</form>
