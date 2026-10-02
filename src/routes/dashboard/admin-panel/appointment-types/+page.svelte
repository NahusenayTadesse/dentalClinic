<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import type { LookupRow } from '@nahu/admin-kit/components/lookup/types.js';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import RowButton from '@nahu/admin-kit/components/RowButton.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import ServiceChecklist from '$lib/components/ServiceChecklist.svelte';
	import { config } from './lookup';
	import { add, edit, usualWork, type UsualWork } from './schema';

	/**
	 * Appointment types, plus the one thing a lookup row cannot hold: the services each type usually
	 * involves, which completing a visit pre-ticks. A link table, so it is a column of its own and
	 * one shared dialog rather than a field on the edit form (`LookupConfig` has no many-to-many
	 * field, and one screen is not reason enough to give it one).
	 */
	let { data } = $props();

	/** Each type's usual services, keyed by type id. */
	const usualOf = $derived(
		data.usual.reduce<Record<number, typeof data.usual>>((byType, u) => {
			(byType[u.appointmentTypeId] ??= []).push(u);
			return byType;
		}, {})
	);

	let open = $state(false);
	let seed = $state<Partial<UsualWork>>({});
	let typeName = $state('');

	const usualColumn: ColumnDef<LookupRow> = {
		id: 'usualWork',
		header: 'Usual work',
		enableSorting: false,
		cell: ({ row }) => {
			const work = usualOf[row.original.id] ?? [];
			return renderComponent(RowButton, {
				label: work.length ? work.map((w) => w.name).join(', ') : 'None — choose',
				onclick: () => {
					typeName = String(row.original.name ?? '');
					seed = { id: row.original.id, serviceIds: work.map((w) => w.serviceId) };
					open = true;
				}
			});
		}
	};

	const page = $derived({ ...config, extraColumns: [usualColumn] });
	const services = $derived(
		data.serviceOptions.map((s) => ({ serviceId: s.value, name: s.name, price: s.price }))
	);
</script>

<LookupPage {data} config={page} schemas={{ add, edit }} />

<FormDialog
	title="Usual work for {typeName}"
	description="Ticked for you when a visit of this type is completed. Work on a tooth is charted on the dental chart instead, so only whole-mouth services are listed."
	action="?/usualWork"
	data={data.usualForm}
	schema={usualWork}
	bind:open
	{seed}
	hideTrigger
>
	{#snippet fields({ form, values })}
		<input type="hidden" name="id" value={values.id} />
		{#if services.length}
			<ServiceChecklist {form} {services} legend="Whole-mouth services" />
		{:else}
			<p class="text-sm text-muted-foreground">
				No whole-mouth services are in the catalogue. Add one under Services, charted on the whole
				mouth.
			</p>
		{/if}
	{/snippet}
</FormDialog>
