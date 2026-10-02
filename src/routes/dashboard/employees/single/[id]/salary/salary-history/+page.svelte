<script lang="ts">
	import { columns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';

	import Loading from '$lib/components/Loading.svelte';
	import { Frown, ArrowRight } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import MonthYear from '$lib/formComponents/MonthYear.svelte';

	let month = $state(
		new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString(undefined, {
			month: 'long'
		}) +
			'_' +
			new Date().getFullYear()
	);

	let link = $derived(`${month}`);
</script>

<svelte:head>
	<title>Salariy History for {data?.name}</title>
</svelte:head>

{#if data?.salaryHistory.length === 0}
	<div class="flex h-96 w-5xl flex-col items-center justify-center">
		<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
			<Frown class="h-12 w-16  animate-bounce" />
			No salaries entered for {data?.salaryDetail.name}
		</p>
		<!-- <Button href="/dashboard/services/add-services"><Plus />Add New Staff Members</Button> -->
	</div>
{:else}
	<div
		class="mx-auto max-w-4xl gap-4 rounded-lg bg-white/80 p-4 shadow-sm backdrop-blur-sm lg:flex lg:items-center lg:justify-between dark:bg-gray-800/80"
	>
		<div class="flex-1">
			<h1 class="text-lg font-semibold text-gray-900 lg:text-2xl dark:text-gray-100">
				Salaries History for {data?.salaryDetail.name}
			</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Total salary changes: <span class="font-medium text-gray-800 dark:text-gray-100"
					>{data?.salaryHistory.length - 1}</span
				>
			</p>
		</div>
	</div>

	<DataTable
		data={data.salaryHistory}
		{columns}
		fileName="{data?.salaryDetail?.name} Salary History"
		search={true}
	/>
{/if}
