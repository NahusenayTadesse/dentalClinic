<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Sheet, Plus } from '@lucide/svelte';
	let { data, children } = $props();
</script>

<div class="mb-8 flex flex-row flex-wrap items-center justify-start gap-2">
	<Button
		href="/dashboard/customers"
		variant={page.url.pathname === '/dashboard/customers' ? 'default' : 'outline'}
		><Sheet /> Customers</Button
	>
	<Button
		href="/dashboard/customers/add-customer"
		variant={page.url.pathname === '/dashboard/customers/add-customer' ? 'default' : 'outline'}
		><Plus /> Add Customers</Button
	>
</div>

{@render children?.()}
