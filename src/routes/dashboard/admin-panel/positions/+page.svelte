<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import { config } from './lookup';

	let { data } = $props();
</script>

<LookupPage {data} {config} />
