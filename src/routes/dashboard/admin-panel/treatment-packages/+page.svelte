<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import type { LookupRow } from '@nahu/admin-kit/components/lookup/types.js';
	import { renderComponent } from '@nahu/admin-kit/components/ui/data-table/index.js';
	import RowButton from '@nahu/admin-kit/components/RowButton.svelte';
	import { config } from './lookup';
	import { add, edit, type PackageItems as Items } from './schema';
	import PackageItems from './PackageItems.svelte';

	/**
	 * Treatment packages, plus the one thing a lookup row cannot hold: the services in each, with how
	 * many. Their own column and one shared dialog, as Appointment Types does for its usual work.
	 */
	let { data } = $props();

	let open = $state(false);
	let seed = $state<Items>({ id: 0, items: [] });
	let current = $state({ name: '', price: 0 });

	const itemsOf = $derived(
		data.items.reduce<Record<number, typeof data.items>>((byPackage, i) => {
			(byPackage[i.packageId] ??= []).push(i);
			return byPackage;
		}, {})
	);

	const servicesColumn: ColumnDef<LookupRow> = {
		id: 'services',
		header: 'Services',
		enableSorting: false,
		cell: ({ row }) => {
			const items = itemsOf[row.original.id] ?? [];
			return renderComponent(RowButton, {
				label: items.length
					? items.map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.name}` : i.name)).join(', ')
					: 'None — choose',
				onclick: () => {
					current = {
						name: String(row.original.name ?? ''),
						price: Number(row.original.price ?? 0)
					};
					seed = {
						id: row.original.id,
						items: items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity }))
					};
					open = true;
				}
			});
		}
	};

	const page = $derived({ ...config, extraColumns: [servicesColumn] });
</script>

<LookupPage {data} config={page} schemas={{ add, edit }} />

<PackageItems
	data={data.itemsForm}
	services={data.serviceOptions}
	bind:open
	{seed}
	name={current.name}
	price={current.price}
/>
