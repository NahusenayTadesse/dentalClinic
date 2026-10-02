<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { add, edit, type Edit } from './schema';
	import { makeColumns, type Row } from './columns';

	/**
	 * The categories on the supplies list. Hand-written rather than a `LookupPage` because it is not
	 * a plain lookup: it shows what each type holds, and has no status to switch (CLAUDE.md §2).
	 */
	let { data } = $props();

	type Field = ComponentProps<typeof InputComp>;

	let editOpen = $state(false);
	let editSeed = $state<Partial<Edit>>({});
	const columns = $derived(
		makeColumns((row: Row) => {
			editSeed = { id: row.id, name: row.name, description: row.description ?? '' };
			editOpen = true;
		}, data.isSuperAdmin ?? false)
	);
</script>

<svelte:head>
	<title>Supply Types</title>
</svelte:head>

{#snippet typeFields(form: Field['form'], errors: Field['errors'])}
	<InputComp {form} {errors} label="Name" name="name" required placeholder="e.g. Machinery" />
	<InputComp
		{form}
		{errors}
		label="Description"
		type="textarea"
		name="description"
		rows={4}
		placeholder="What belongs in this category"
	/>
{/snippet}

<div class="flex flex-col gap-4">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-2xl font-bold">Supply Types</h1>
		<FormDialog
			title="Add a supply type"
			action="?/add"
			data={data.form}
			schema={add}
			triggerLabel="Add supply type"
			resetOnSuccess
		>
			{#snippet fields({ form, errors })}
				{@render typeFields(form, errors)}
			{/snippet}
		</FormDialog>
	</header>

	<DataTable {columns} data={data.allData} search fileName="Supply Types" />
</div>

<FormDialog
	title="Change this supply type"
	action="?/edit"
	data={data.editForm}
	schema={edit}
	bind:open={editOpen}
	seed={editSeed}
	hideTrigger
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="id" value={values.id} />
		{@render typeFields(form, errors)}
	{/snippet}
</FormDialog>
