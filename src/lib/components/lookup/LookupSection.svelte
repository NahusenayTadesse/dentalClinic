<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { superForm } from 'sveltekit-superforms/client';
	import { toast } from 'svelte-sonner';

	import { Button } from '$lib/components/ui/button/index';
	import DataTable from '$lib/components/Table/data-table.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import LookupFields from './LookupFields.svelte';
	import { lookupColumns, type LookupForm } from './columns';
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
		actions
	}: {
		config: LookupConfig;
		rows: LookupRow[];
		addForm: LookupForm;
		editForm: LookupForm;
		canDelete?: boolean;
		options?: LookupOptions;
		/** Namespaced form actions — `{ add: '?/addFamily', edit: '?/editFamily', … }`. */
		actions: { add: string; edit: string; delete: string };
	} = $props();

	const { form, errors, enhance, delayed, message } = superForm(addForm, {});

	const columns = $derived(lookupColumns(config, { editForm, canDelete, options, actions }));

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

<div class="flex flex-col gap-4">
	<DialogComp title="+ Add {config.entity}" variant="outline" triggerClass="self-start">
		<form
			action={actions.add}
			use:enhance
			id={actions.add}
			class="flex flex-col gap-4"
			method="post"
		>
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

	{#key rows}
		<DataTable {columns} data={rows} search={false} fileName={config.plural} />
	{/key}
</div>
