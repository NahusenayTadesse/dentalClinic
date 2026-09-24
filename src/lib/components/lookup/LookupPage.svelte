<script lang="ts">
	import { Plus } from '@lucide/svelte';

	import { Button } from '$lib/components/ui/button/index';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LookupFields from './LookupFields.svelte';
	import { lookupColumns } from './columns';
	import { createForm } from '$lib/forms/createForm';
	import type { LookupConfig, LookupOptions, LookupRow } from './types';
	import type { LookupForm, LookupSchema } from './columns';

	/**
	 * A whole admin-panel lookup screen: add dialog, table, per-row edit and delete.
	 *
	 * Pairs with `contentCrud` on the server. Between them a lookup route is a `LookupConfig`,
	 * a zod schema and about twenty lines of server file — replacing the ~290 lines each of
	 * these screens used to carry.
	 */
	let {
		data,
		config,
		schemas
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
		/**
		 * The schemas the two forms post to, so a field is checked before the round trip. Optional
		 * only because the server validates regardless; a new screen should pass them.
		 */
		schemas?: { add?: LookupSchema; edit?: LookupSchema };
	} = $props();

	let open = $state(false);

	// An add form starts from the load's empty form once; after a save superforms resets it.
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.addForm, schemas?.add, {
		// Empty again after a save, so reopening does not show the row just added.
		resetForm: true,
		// Closed only on success: a refused save keeps the dialog and its errors on screen. Every
		// one of these dialogs used to stay open on success, showing what had just been saved.
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});

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
		lookupColumns(config, {
			editForm: data.editForm,
			canDelete: data.isSuperAdmin,
			options,
			editSchema: schemas?.edit
		})
	);
</script>

<svelte:head>
	<title>{config.plural}</title>
</svelte:head>

<DialogComp bind:open title="+ Add New {config.entity}" variant="default">
	<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
		<Errors allErrors={$allErrors} />
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
