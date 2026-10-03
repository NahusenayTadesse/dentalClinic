<script lang="ts">
	import FileCheck from '@lucide/svelte/icons/file-check';
	import Upload from '@lucide/svelte/icons/upload';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { IMPORT_LISTS, countOf, hasDates, type ImportKind } from '$lib/dataImport';
	import ImportReport from './ImportReport.svelte';
	import { MAX_IMPORT_MB, importSheet, type ImportSheet } from './schema';
	import type { ImportMessage } from './+page.server';

	/**
	 * Choosing the file, checking it, and importing it.
	 *
	 * **Check, then import, with the same file.** Both buttons post the form; the server reads the
	 * file from the start each time, so what is imported is never what an earlier check said but
	 * what the file says now. `resetForm: false` is what keeps the chosen file in the form between
	 * the two posts — superforms empties a form after a successful one by default.
	 *
	 * The report belongs to one file. Choose another and the old report is put away, so an Import
	 * button never stands under a report about a different file.
	 */
	let { data, kind }: { data: SuperValidated<ImportSheet, ImportMessage>; kind: ImportKind } =
		$props();

	const list = $derived(IMPORT_LISTS[kind]);
	const dated = $derived(hasDates(kind));

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, message, allErrors, reset } = createForm(
		data,
		importSheet,
		{
			resetForm: false,
			onUpdated({ form: done }) {
				// An import that saved rows: clear the file, so a second click cannot import it twice.
				if (done.message?.report?.imported) reset({ keepMessage: true });
			}
		}
	);

	/** Which button was pressed, for its spinner. */
	let pressed = $state<'check' | 'import'>('check');

	const report = $derived($message?.report);
	const chosen = $derived<File | undefined>($form.file);
	const current = $derived(
		report !== undefined &&
			report.kind === kind &&
			(report.imported !== undefined ||
				(chosen !== undefined &&
					chosen.name === report.file.name &&
					chosen.size === report.file.size))
	);

	/** How many the Import button will bring in, as the duplicates box now stands. */
	const toImport = $derived.by(() => {
		if (!report) return 0;
		if ($form.includeDuplicates === report.includeDuplicates) return report.ready;
		return report.ready + ($form.includeDuplicates ? 1 : -1) * report.duplicateRows;
	});
	const canImport = $derived(current && report?.imported === undefined && toImport > 0);

	const calendars = [
		{ value: 'ethiopian', name: 'Ethiopian calendar (ዓ.ም)' },
		{ value: 'gregorian', name: 'Gregorian calendar (G.C.)' }
	];
</script>

<form method="POST" enctype="multipart/form-data" use:enhance class="flex flex-col gap-4">
	<input type="hidden" name="kind" value={kind} />

	<Errors allErrors={$allErrors} />

	<InputComp
		label="The {list.one} list"
		name="file"
		type="file"
		{form}
		{errors}
		accept=".xlsx,.csv"
		compress={false}
		placeholder="Excel (.xlsx) or CSV, up to {MAX_IMPORT_MB} MB"
	/>

	{#if dated}
		<InputComp
			label="The dates in the file are written in the"
			name="calendar"
			type="select"
			{form}
			{errors}
			items={calendars}
			placeholder="Choose the calendar"
			description="Asked, not guessed: 15/03/2016 is a real day in both, seven years apart."
		/>
	{/if}

	{#if current && report && report.duplicateRows > 0 && report.imported === undefined}
		<InputComp
			label="Possible duplicates"
			name="includeDuplicates"
			type="checkboxSingle"
			{form}
			{errors}
			placeholder="I have checked them: they are different {list.many}. Import them too."
		/>
	{/if}

	<div class="flex flex-wrap gap-2">
		<Button
			type="submit"
			formaction="?/check"
			variant={canImport ? 'outline' : 'default'}
			onclick={() => (pressed = 'check')}
			disabled={$delayed}
		>
			{#if $delayed && pressed === 'check'}
				<LoadingBtn name="Checking" />
			{:else}
				<FileCheck class="size-4" /> {current ? 'Check again' : 'Check the file'}
			{/if}
		</Button>

		{#if canImport}
			<Button
				type="submit"
				formaction="?/import"
				onclick={() => (pressed = 'import')}
				disabled={$delayed}
			>
				{#if $delayed && pressed === 'import'}
					<LoadingBtn name="Importing" />
				{:else}
					<Upload class="size-4" /> Import {countOf(kind, toImport)}
				{/if}
			</Button>
		{/if}
	</div>
</form>

{#if current && report}
	<ImportReport {report} />
{/if}
