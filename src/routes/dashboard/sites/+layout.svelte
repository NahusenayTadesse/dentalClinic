<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Sheet, Plus } from '@lucide/svelte';
	let { data, children } = $props();
</script>

<div class="mb-8 flex flex-row flex-wrap items-center justify-start gap-2">
	<Button
		href="/dashboard/sites"
		variant={page.url.pathname === '/dashboard/sites' ? 'default' : 'outline'}
		><Sheet /> All Sites
	</Button>

	<Button
		href="/dashboard/sites/add-site"
		variant={page.url.pathname === '/dashboard/sites/add-site' ? 'default' : 'outline'}
		><Plus /> Add Site</Button
	>
</div>

{@render children?.()}
