<script lang="ts">
	import ReportBody from '$lib/components/reports/ReportBody.svelte';
	import { pageForGroup } from '../sections';

	let { data } = $props();

	const meta = $derived(pageForGroup(data.group));
</script>

<ReportBody
	title={meta.title}
	blurb={meta.blurb}
	group={data.group}
	stats={data.stats}
	charts={data.charts}
	detail={data.detail}
	section={data.filters.section}
	failure={data.failure}
/>
