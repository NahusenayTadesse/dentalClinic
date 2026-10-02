<script lang="ts">
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import { columns } from './columns';

	/**
	 * Employees who have left, kept for history. The table's own column filters narrow it — by
	 * department, education, employment status and years served.
	 */
	let { data } = $props();
</script>

<svelte:head>
	<title>Inactive Employees</title>
</svelte:head>

<h2 class="my-4 text-2xl">Inactive Employees</h2>

{#if data.staffList.length === 0}
	<p class="rounded-lg border p-6 text-center text-muted-foreground">
		Nobody has left. Employees who are terminated are listed here, for the record.
	</p>
{:else}
	<DataTable
		data={data.staffList}
		{columns}
		fileName="Inactive employees"
		charts
		facetKeys={['department', 'education', 'status', 'years']}
		facetLabels={{
			department: 'Department',
			education: 'Education',
			status: 'Status',
			years: 'Years'
		}}
	/>
{/if}
