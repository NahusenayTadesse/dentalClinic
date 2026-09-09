<script lang="ts">
	import { adjustmentColumns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';

	export const getEthiopianYear = (year: number): string => {
		if (!year) return '';

		// Use January 1st to avoid Ethiopian new-year boundary issues
		const date = new Date(year, 0, 1);

		const formatter = new Intl.DateTimeFormat('am-ET', {
			year: 'numeric',
			calendar: 'ethiopic'
		});

		return formatter.format(date);
	};
</script>

<svelte:head>
	<title>Salaries Adjustments</title>
</svelte:head>

<div class="mb-4 flex flex-col">
	<h4>Salary Adjustments</h4>
	<DataTable data={data?.adjustments} columns={adjustmentColumns} fileName="Salary Adjustments" />
</div>
