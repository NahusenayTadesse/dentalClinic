<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { toast } from 'svelte-sonner';

	import { Button } from '$lib/components/ui/button/index';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import LookupFields from './LookupFields.svelte';
	import { lookupColumns } from './columns';
	import type { LookupConfig, LookupOptions, LookupRow } from './types';
	import type { LookupForm } from './columns';

	/**
	 * A whole admin-panel lookup screen: add dialog, table, per-row edit and delete.
	 *
	 * Pairs with `contentCrud` on the server. Between them a lookup route is a `LookupConfig`,
	 * a zod schema and about twenty lines of server file — replacing the ~290 lines each of
	 * these screens used to carry.
	 */
	let {
		data,
		config
	}: {
		/**
		 * The route's load: `addForm`, `editForm`, `rows`, `isSuperAdmin` from the layout, and one
		 * entry per `reference` field holding its options — all of which `contentCrud` returns.
		 */
		data: {
			addForm: LookupForm;
			editForm: LookupForm;
			rows: LookupRow[];
			isSuperAdmin?: boolean;
		} & Record<string, unknown>;
		config: LookupConfig;
	} = $props();

	const { form, errors, enhance, delayed, message } = superForm(data.addForm, {});

	/**
	 * Picker options, re-keyed from the load's names (`regionList`) to the field's own name
	 * (`regionId`), so neither the form nor the table has to know where they came from.
	 */
	const options = $derived(
		Object.fromEntries(
			config.fields
				.filter((f) => f.type === 'reference' && f.options)
				.map((f) => [f.name, (data[f.options!] ?? []) as LookupOptions[string]])
		) as LookupOptions
	);

	const columns = $derived(
		lookupColumns(config, { editForm: data.editForm, canDelete: data.isSuperAdmin, options })
	);

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
</script>

<svelte:head>
	<title>{config.plural}</title>
</svelte:head>

<DialogComp title="+ Add New {config.entity}" variant="default">
	<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
		<LookupFields fields={config.fields} {form} {errors} entity={config.entity} {options} />

		<Button type="submit" form="main">
			{#if $delayed}
				<LoadingBtn name="Adding {config.entity}" />
			{:else}
				<Plus /> Add {config.entity}
			{/if}
		</Button>
	</form>
</DialogComp>

{#key data.rows}
	<DataTable {columns} data={data.rows} search={true} fileName={config.plural} />
{/key}
