<script lang="ts">
	import { page } from '$app/state';
	import Button from '@nahu/admin-kit/components/ui/button/button.svelte';
	import Sheet from '@lucide/svelte/icons/sheet';
	import Plus from '@lucide/svelte/icons/plus';
	let { children } = $props();
</script>

<div class="mb-8 flex flex-row flex-wrap items-center justify-start gap-2">
	<Button
		href="/dashboard/customers"
		variant={page.url.pathname === '/dashboard/customers' ? 'default' : 'outline'}
		><Sheet /> Payers</Button
	>
	<Button
		href="/dashboard/customers/add-customer"
		variant={page.url.pathname === '/dashboard/customers/add-customer' ? 'default' : 'outline'}
		><Plus /> Add a payer</Button
	>
</div>

{@render children?.()}
