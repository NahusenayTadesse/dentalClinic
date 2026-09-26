<script lang="ts">
	import LookupPage from '$lib/components/lookup/LookupPage.svelte';
	import { config } from './lookup';
	import { add, edit } from './schema';

	let { data } = $props();
</script>

<LookupPage {data} {config} schemas={{ add, edit }} />
