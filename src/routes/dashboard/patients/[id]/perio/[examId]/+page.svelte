<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Printer from '@lucide/svelte/icons/printer';
	import Save from '@lucide/svelte/icons/save';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { attachmentChanges, changeCounts, perioSummary } from '$lib/perio';
	import { saveExam } from '../schema';
	import PerioGrid from './PerioGrid.svelte';
	import PerioSummaryLine from '../PerioSummaryLine.svelte';

	/**
	 * One periodontal exam. A draft is the grid to fill in, saved as often as the clinician likes and
	 * finished once; a finished exam is the same grid, read only, and the baseline for the next.
	 * The figures above the grid are `$lib/perio.ts`'s, worked out as the numbers are typed.
	 */
	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors, tainted, isTainted } = createForm(
		data.forms.save,
		saveExam,
		{ dataType: 'json', resetForm: false }
	);

	const draft = $derived(!data.exam.completedAt);
	const editable = $derived(draft && data.canWrite);
	const base = $derived(`/dashboard/patients/${data.patient.id}/perio`);
	const summary = $derived(perioSummary($form.teeth));
	const changes = $derived(
		data.previous ? changeCounts(attachmentChanges(data.previous.teeth, $form.teeth)) : null
	);
	const unsaved = $derived(isTainted($tainted));
	const day = (iso: string) => formatEthiopianDate(new Date(iso));
</script>

<svelte:head>
	<title>{data.patient.fullName} — Periodontal chart {day(data.exam.examinedOn)}</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center gap-2 print:hidden">
		<Button href={base} variant="ghost" size="sm"><ArrowLeft class="size-4" /> All exams</Button>
		<div class="ml-auto flex flex-wrap gap-2">
			<Button href="{base}/{data.exam.id}/print" target="_blank" variant="outline" size="sm">
				<Printer class="size-4" /> Print
			</Button>
			{#if editable}
				<StepButton
					id="discard-exam"
					action="?/discard"
					data={data.forms.step}
					label="Discard draft"
					icon={Trash}
					variant="ghost"
					confirm={{
						title: 'Discard this exam?',
						description: 'Its readings go with it. A finished exam cannot be discarded.',
						action: 'Discard'
					}}
				/>
				{#if !unsaved}
					<StepButton
						id="finish-exam"
						action="?/finish"
						data={data.forms.step}
						label="Finish exam"
						icon={CircleCheck}
						variant="default"
						confirm={{
							title: 'Finish this exam?',
							description:
								'It cannot be changed afterwards, and the next exam will be compared with it.',
							action: 'Finish'
						}}
					/>
				{/if}
			{/if}
		</div>
	</div>

	<header class="flex flex-wrap items-center gap-3">
		<h2 class="text-xl font-bold">Periodontal chart · {day(data.exam.examinedOn)}</h2>
		<Badge variant={draft ? 'secondary' : 'outline'}>{draft ? 'Being charted' : 'Finished'}</Badge>
		{#if data.exam.provider}
			<span class="text-sm text-muted-foreground">Probed by {data.exam.provider}</span>
		{/if}
	</header>

	<PerioSummaryLine
		{summary}
		{changes}
		comparedWith={data.previous ? day(data.previous.examinedOn) : null}
	/>

	<form method="post" action="?/save" use:enhance class="flex flex-col gap-4">
		<Errors allErrors={$allErrors} />
		<PerioGrid
			bind:teeth={$form.teeth}
			previous={data.previous?.teeth ?? null}
			readonly={!editable}
		/>

		{#if editable}
			<InputComp
				label="Notes"
				name="notes"
				type="textarea"
				rows={2}
				required={false}
				{form}
				{errors}
				placeholder="What the numbers do not say: smoker, diabetic, referred to a periodontist"
			/>
			<div class="flex flex-wrap items-center justify-end gap-3 print:hidden">
				{#if unsaved}
					<span class="text-sm text-muted-foreground"
						>Unsaved readings — save before finishing.</span
					>
				{/if}
				<Button type="submit" disabled={$delayed}>
					{#if $delayed}
						<LoadingBtn name="Saving" />
					{:else}
						<Save class="size-4" /> Save readings
					{/if}
				</Button>
			</div>
		{:else if data.exam.notes}
			<p class="text-sm whitespace-pre-line"><strong>Notes:</strong> {data.exam.notes}</p>
		{/if}
	</form>
</div>
