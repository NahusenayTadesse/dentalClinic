<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { createForm } from '$lib/forms/createForm';

	import { Button } from '$lib/components/ui/button/index';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';
	import LookupFields from './LookupFields.svelte';
	import { lookupColumns, type LookupForm, type LookupSchema } from './columns';
	import type { LookupConfig, LookupOptions, LookupRow } from './types';

	/**
	 * One child table on a detail page — the rows a single parent owns.
	 *
	 * The same descriptor as `LookupPage`, and the same table and dialogs underneath. Two things
	 * differ, and only two:
	 *
	 *   - it renders inside whatever section the page puts it in, with no page title of its own
	 *   - its actions are namespaced, because a detail page hosts several of these and they
	 *     cannot all post to `?/add`
	 *
	 * Pairs with `childCrud` on the server, which scopes every read and write to the owner.
	 */
	let {
		config,
		rows,
		addForm,
		editForm,
		canDelete = false,
		options,
		actions,
		schemas,
		readonly = false
	}: {
		config: LookupConfig;
		rows: LookupRow[];
		addForm: LookupForm;
		editForm: LookupForm;
		canDelete?: boolean;
		options?: LookupOptions;
		/** Namespaced form actions — `{ add: '?/addFamily', edit: '?/editFamily', … }`. */
		actions: { add: string; edit: string; delete: string };
		/**
		 * The schemas the two forms post to, so a field is checked before the round trip. Optional
		 * only because the server validates regardless; a new section should pass them.
		 */
		schemas?: { add?: LookupSchema; edit?: LookupSchema };
		/** Hide the add button — for a viewer who may read these rows but not change them. */
		readonly?: boolean;
	} = $props();

	let open = $state(false);

	// An add form starts from the load's empty form once; after a save superforms resets it.
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(addForm, schemas?.add, {
		// Empty again after a save, so reopening does not show the entry just added.
		resetForm: true,
		onUpdated({ form }) {
			if (form.message?.type === 'success') open = false;
		}
	});

	const columns = $derived(
		lookupColumns(config, {
			editForm,
			canDelete,
			options,
			actions,
			editSchema: schemas?.edit,
			readonly
		})
	);
</script>

<div class="flex flex-col gap-4">
	{#if !readonly}
		<DialogComp bind:open title="+ Add {config.entity}" variant="outline" triggerClass="self-start">
			<form
				action={actions.add}
				use:enhance
				id={actions.add}
				class="flex flex-col gap-4"
				method="post"
			>
				<Errors allErrors={$allErrors} />
				<LookupFields fields={config.fields} {form} {errors} entity={config.entity} {options} />

				<Button type="submit" form={actions.add}>
					{#if $delayed}
						<LoadingBtn name="Adding {config.entity}" />
					{:else}
						<Plus /> Add {config.entity}
					{/if}
				</Button>
			</form>
		</DialogComp>
	{/if}

	{#key rows}
		<!--
			Sized to its rows. The table's default claims 80% of the screen, which is right for a list
			page and left a chart of five sections as five screens of empty frame.
		-->
		<DataTable {columns} data={rows} search={false} fileName={config.plural} height="auto" />
	{/key}
</div>
