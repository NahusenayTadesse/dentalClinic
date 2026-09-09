<script lang="ts">
	import LookupPage from '$lib/components/lookup/LookupPage.svelte';
	import { config } from './lookup';

	let { data } = $props();
</script>

<LookupPage {data} {config} />
