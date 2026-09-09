<script lang="ts">
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';

	import Loading from '$lib/components/Loading.svelte';
	import { Frown, Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<svelte:head>
	<title>Roles List</title>
</svelte:head>

{#await data}
	<Loading name="Customers" />
{:then customerList}
	{#if data.roleList.length === 0}
		<div class="flex h-96 w-full flex-col items-center justify-center lg:w-5xl">
			<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
				<Frown class="h-12 w-16  animate-bounce" />
				Users List is Empty
			</p>
			<Button href="/dashboard/users/add-users"><Plus />Add New Users</Button>
		</div>
	{:else}
		<h2 class="my-4 text-2xl">No of Roles {data.roleList?.length}</h2>

		<DataTable data={data.roleList} {columns} fileName="Roles List" />
	{/if}
{:catch}
	<div class="flex h-screen w-screen flex-col items-center justify-center">
		<h1 class="text-red-500">Unexpected Error: Reload</h1>
	</div>
{/await}
