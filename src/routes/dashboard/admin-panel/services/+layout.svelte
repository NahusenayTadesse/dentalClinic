<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';
	// import DialogComp from "$lib/formComponents/DialogComp.svelte";
	// import AddCustomer from "$lib/forms/AddCustomer.svelte";
	import { Sheet } from '@lucide/svelte';
	let { data, children } = $props();
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
	<!-- <DialogComp title="Add New Customer" {content} /> -->
</div>

<!-- {#snippet content()}

  <AddCustomer data={data?.form} action="/dashbaord/customers?/addCustomer" />

{/snippet} -->

{@render children?.()}
