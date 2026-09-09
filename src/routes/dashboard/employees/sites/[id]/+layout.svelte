<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';

	import { Calendar, Plus, Sheet } from '@lucide/svelte';
	let { children } = $props();
</script>

<div class="mb-8 flex flex-row flex-wrap items-center justify-start gap-2">
	<Button
		href="/dashboard/employees/sites/{page.params.id}"
		variant={page.url.pathname === `/dashboard/employees/sites/${page.params.id}`
			? 'default'
			: 'outline'}><Sheet /> Active Employees</Button
	>
	<Button
		href="/dashboard/employees/sites/{page.params.id}/inactive"
		variant={page.url.pathname === `/dashboard/employees/sites/${page.params.id}/inactive`
			? 'destructive'
			: 'outline'}
		class={page.url.pathname === `/dashboard/employees/sites/${page.params.id}/inactive`
			? ''
			: 'text-destructive'}><Sheet /> Inactive Employees</Button
	>

	<Button
		href="/dashboard/employees/sites/{page.params.id}/attendance"
		variant={page.url.pathname.startsWith(`/dashboard/employees/sites/${page.params.id}/attendance`)
			? 'default'
			: 'outline'}><Calendar /> Attendance</Button
	>
</div>

{@render children()}
