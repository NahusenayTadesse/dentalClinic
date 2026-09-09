<script lang="ts">
	let { data } = $props();

	import SiteViewer from '$lib/components/site-viewer.svelte';
</script>

<svelte:head>
	<title>Employee List</title>
</svelte:head>

<SiteViewer
	baseLink="/dashboard/employees/sites"
	sites={data?.siteList}
	unitLabel="Employees"
	title="Select a Site for Employees"
/>
