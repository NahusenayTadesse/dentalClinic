<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';
	// import DialogComp from "$lib/formComponents/DialogComp.svelte";
	// import AddCustomer from "$lib/forms/AddCustomer.svelte";
	import { Plus, Sheet } from '@lucide/svelte';
	let { children } = $props();
</script>

<div class="mb-8 flex flex-row items-center justify-start gap-2">
	<Button
		href="/dashboard/admin-panel/roles"
		variant={page.url.pathname === '/dashboard/admin-panel/roles' ? 'default' : 'outline'}
		><Sheet /> All Roles</Button
	>
	<Button
		href="/dashboard/admin-panel/roles/add-roles"
		variant={page.url.pathname === '/dashboard/admin-panel/roles/add-roles' ? 'default' : 'outline'}
		><Plus /> Add Roles</Button
	>
	<!-- <DialogComp title="Add New Customer" {content} /> -->
</div>

<!-- {#snippet content()}

  <AddCustomer data={data?.form} action="/dashbaord/customers?/addCustomer" />

{/snippet} -->

{@render children?.()}
