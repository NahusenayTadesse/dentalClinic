<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { orderColumns } from './columns';
	import { newOrder } from './schema';

	/**
	 * Purchase orders: each with what has arrived and what the supplier has invoiced, and starting
	 * one. An order is drafted, sent, received as deliveries come, and its invoice paid.
	 */
	let { data } = $props();

	let open = $state(false);
</script>

<svelte:head>
	<title>Purchase orders</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<Section title="Purchase orders" IconComp={ShoppingCart} style="identityIcon">
		{#snippet editDialog()}
			<Button size="sm" class="ml-auto" disabled={!data.branchChosen} onclick={() => (open = true)}>
				<Plus class="size-4" /> New order
			</Button>
		{/snippet}
		{#if !data.branchChosen}
			<p class="mb-3 text-sm text-muted-foreground">
				Choose a branch in the top bar to order for it: each branch orders for its own store.
			</p>
		{/if}
		{#if data.orders.length}
			<DataTable
				columns={orderColumns}
				data={data.orders}
				facetKeys={['status', 'supplier']}
				fileName="purchase-orders"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">
				No orders yet. Start one, and add the items running low with one button.
			</p>
		{/if}
	</Section>
</div>

<FormDialog
	title="New purchase order"
	action="?/draft"
	data={data.form}
	schema={newOrder}
	bind:open
	hideTrigger
	submitLabel="Start"
>
	{#snippet fields({ form, errors })}
		<InputComp
			label="Supplier"
			name="supplierId"
			type="select"
			items={data.suppliers}
			{form}
			{errors}
		/>
	{/snippet}
</FormDialog>
