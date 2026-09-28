<script lang="ts">
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';
	import Button from '$lib/components/ui/button/button.svelte';

	import Frown from '@lucide/svelte/icons/frown';
	import Plus from '@lucide/svelte/icons/plus';
</script>

<svelte:head>
	<title>Payers</title>
</svelte:head>

{#if data.customerList.length === 0}
	<div class="flex h-96 w-5xl items-center justify-center">
		<p class="mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16" />
			No payers added yet
		</p>
		<Button href="/dashboard/customers/add-customer"><Plus /> Add a payer</Button>
	</div>
{:else}
	<h2 class="my-4 text-2xl">{data.customerList.length} payers</h2>

	<!-- A search rather than facets: a clinic has a handful of payers and nothing to group them by. -->
	<DataTable data={data.customerList} {columns} search fileName="payers" />
{/if}
