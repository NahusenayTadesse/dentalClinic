<script>
	import { page } from '$app/state';
	import Button from '@nahu/admin-kit/components/ui/button/button.svelte';
	import { Sheet } from '@lucide/svelte';
	let { children } = $props();
</script>

<div class="mb-8 flex flex-row items-center justify-start gap-2">
	<Button
		href="/dashboard/admin-panel/services"
		variant={page.url.pathname === '/dashboard/admin-panel/services' ? 'default' : 'outline'}
		><Sheet /> Services
	</Button>
	<Button
		href="/dashboard/admin-panel/services/categories"
		variant={page.url.pathname === '/dashboard/admin-panel/services/categories'
			? 'default'
			: 'outline'}><Sheet /> Services Categories</Button
	>
</div>

{@render children?.()}
