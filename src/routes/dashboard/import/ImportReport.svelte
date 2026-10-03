<script lang="ts">
	import * as Table from '@nahu/admin-kit/components/ui/table/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import { IMPORT_LISTS, countOf, type ImportReport } from '$lib/dataImport';

	/**
	 * What a check found, or what an import saved: the counts, every problem by the row number
	 * Excel shows, the rows that look like records already here, and the first rows as they will
	 * be saved — so a wrong calendar or a column read as the wrong thing is seen before importing.
	 */
	let { report }: { report: ImportReport } = $props();

	const list = $derived(IMPORT_LISTS[report.kind]);
	const figures = $derived([
		{ label: 'Rows in the file', value: report.rows },
		{
			label: report.imported === undefined ? 'Ready to import' : 'Imported',
			value: report.imported ?? report.ready
		},
		{ label: 'With problems', value: report.problemRows },
		{ label: 'Possibly here already', value: report.duplicateRows }
	]);
</script>

<div class="flex flex-col gap-6">
	{#if report.imported !== undefined}
		<Notice tone="success" title="{countOf(report.kind, report.imported)} imported.">
			{list.approval ?? `They are in ${list.title} now.`}
			{#snippet actions()}
				<Button href={list.listUrl} variant="outline" size="sm">Open {list.title}</Button>
			{/snippet}
		</Notice>
	{/if}

	<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each figures as figure (figure.label)}
			<div class="rounded-lg border bg-card p-3">
				<dt class="text-sm text-muted-foreground">{figure.label}</dt>
				<dd class="text-2xl font-semibold tabular-nums">{figure.value.toLocaleString('en-US')}</dd>
			</div>
		{/each}
	</dl>

	{#if report.ignored.length}
		<Notice tone="warning" title="Not read:">
			{report.ignored.join(', ')}. These headings are not columns of {list.title.toLowerCase()} — rename
			them to match the template if they hold something that should come in.
		</Notice>
	{/if}

	{#if report.problems.length}
		<PageSection
			title="Problems"
			hint="These rows are left out. Fix them in the file and import it again — the rows already imported are recognised and left out."
		>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-16">Row</Table.Head>
						<Table.Head class="w-48">Column</Table.Head>
						<Table.Head>Problem</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each report.problems as problem, i (i)}
						<Table.Row>
							<Table.Cell class="tabular-nums">{problem.row}</Table.Cell>
							<Table.Cell>{problem.column ?? ''}</Table.Cell>
							<Table.Cell class="whitespace-normal">{problem.message}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
			{#if report.problemsHidden}
				<p class="text-sm text-muted-foreground">
					And {report.problemsHidden} more — fix these first; they are often the same mistake.
				</p>
			{/if}
		</PageSection>
	{/if}

	{#if report.duplicates.length}
		<PageSection
			title="Possibly here already"
			hint={report.includeDuplicates
				? 'These rows are imported anyway, as you asked.'
				: 'These rows are left out unless you tick that they are different, below the file.'}
		>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-16">Row</Table.Head>
						<Table.Head>In the file</Table.Head>
						<Table.Head>Looks like</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each report.duplicates as duplicate (duplicate.row)}
						<Table.Row>
							<Table.Cell class="align-top tabular-nums">{duplicate.row}</Table.Cell>
							<Table.Cell class="align-top">{duplicate.name}</Table.Cell>
							<Table.Cell class="whitespace-normal">
								<ul class="flex flex-col gap-1">
									{#each duplicate.matches as match, i (i)}
										<li>
											{#if match.href}
												<a href={match.href} target="_blank" class="underline">{match.name}</a>
											{:else}
												{match.name}
											{/if}
											<span class="text-muted-foreground">— {match.reason}</span>
										</li>
									{/each}
								</ul>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
			{#if report.duplicateRows > report.duplicates.length}
				<p class="text-sm text-muted-foreground">
					And {report.duplicateRows - report.duplicates.length} more.
				</p>
			{/if}
		</PageSection>
	{/if}

	{#if report.preview.rows.length && report.imported === undefined}
		<PageSection
			title="As they will be saved"
			hint="The first rows ready to import. Check the dates especially: a file read in the wrong calendar is years out."
		>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-16">Row</Table.Head>
						{#each report.preview.headings as heading (heading)}
							<Table.Head>{heading}</Table.Head>
						{/each}
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each report.preview.rows as row (row.row)}
						<Table.Row>
							<Table.Cell class="tabular-nums">{row.row}</Table.Cell>
							{#each row.cells as cell, i (i)}
								<Table.Cell>{cell}</Table.Cell>
							{/each}
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</PageSection>
	{/if}
</div>
