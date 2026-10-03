<script lang="ts">
	import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
	import FileText from '@lucide/svelte/icons/file-text';
	import * as Table from '@nahu/admin-kit/components/ui/table/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Notice from '@nahu/admin-kit/components/Notice.svelte';
	import PageHeader from '@nahu/admin-kit/components/PageHeader.svelte';
	import PageSection from '@nahu/admin-kit/components/PageSection.svelte';
	import { IMPORT_LISTS } from '$lib/dataImport';
	import ImportForm from './ImportForm.svelte';

	/**
	 * Import from a spreadsheet: pick a list, download its template, fill it in or paste into it,
	 * check it, import it. The lists offered are the ones the viewer may add by hand.
	 */
	let { data } = $props();

	const list = $derived(data.kind ? IMPORT_LISTS[data.kind] : undefined);
	const template = (format: 'xlsx' | 'csv') =>
		`/dashboard/import/template?kind=${data.kind}&format=${format}`;
</script>

<div class="mx-auto flex max-w-305 flex-col gap-8 p-4 md:p-8">
	<PageHeader
		title="Import from a Spreadsheet"
		description="Bring in the lists you already keep — patients, payers, staff, suppliers — instead of typing them in one at a time."
	/>

	{#if !list}
		<Notice tone="warning" title="Nothing to import.">
			Importing a list takes the permission to add one of its records by hand, and this account has
			none of them. An administrator can grant them under Admin Panel → Roles.
		</Notice>
	{:else}
		<nav class="flex flex-wrap gap-2" aria-label="Lists">
			{#each data.kinds as kind (kind)}
				<Button
					href="?kind={kind}"
					variant={kind === data.kind ? 'default' : 'outline'}
					aria-current={kind === data.kind ? 'page' : undefined}
				>
					{IMPORT_LISTS[kind].title}
				</Button>
			{/each}
		</nav>

		<p class="text-muted-foreground">{list.blurb}</p>

		<PageSection
			title="1. Get the template"
			hint="Fill it in, or paste your own rows under its headings. The Excel template also lists the names this clinic's lists allow, and keeps phone numbers' leading 0."
		>
			{#snippet actions()}
				<Button href={template('xlsx')} download>
					<FileSpreadsheet class="size-4" /> Excel template
				</Button>
				<Button href={template('csv')} download variant="outline">
					<FileText class="size-4" /> CSV template
				</Button>
			{/snippet}

			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-52">Column</Table.Head>
						<Table.Head>What to write</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each list.columns as column (column.key)}
						<Table.Row>
							<Table.Cell class="align-top font-medium">
								{column.label}{#if column.required}<span class="text-destructive"> *</span>{/if}
							</Table.Cell>
							<Table.Cell class="whitespace-normal text-muted-foreground">{column.hint}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
			<p class="text-sm text-muted-foreground">
				<span class="text-destructive">*</span> Required. Headings are matched loosely — “First name”,
				“Mobile” and “DOB” are understood — and other columns are ignored.
			</p>
		</PageSection>

		<PageSection
			title="2. Check, then import"
			hint="Checking saves nothing. Rows with a problem are left out of the import and listed by row number; the rest are saved together, or not at all."
		>
			{#if list.approval}
				<Notice tone="info">{list.approval}</Notice>
			{/if}
			{#if list.needsBranch && !data.branchChosen}
				<Notice tone="warning" title="Pick a branch first.">
					Imported {list.many} are filed at the branch you are working at. Choose one in the top bar —
					“All branches” is not a place to file them.
				</Notice>
			{/if}

			{#key data.kind}
				<ImportForm data={data.form} kind={list.kind} />
			{/key}
		</PageSection>
	{/if}
</div>
