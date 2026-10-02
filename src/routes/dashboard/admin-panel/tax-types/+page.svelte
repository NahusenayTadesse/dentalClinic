<script lang="ts">
	import LookupPage from '@nahu/admin-kit/components/lookup/LookupPage.svelte';
	import { config } from './lookup';
	import { add, edit } from './schema';

	let { data } = $props();
</script>

<LookupPage {data} {config} schemas={{ add, edit }} />
