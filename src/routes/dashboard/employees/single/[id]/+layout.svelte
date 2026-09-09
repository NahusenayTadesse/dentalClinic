<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';

	import { Pen, Plus, Sheet } from '@lucide/svelte';
	let { children } = $props();
	let startUrl = `/dashboard/employees/single/${page.params.id}/salary/`;
</script>

<div class="mb-8 flex flex-row flex-wrap items-center justify-start gap-2">
	<Button
		href="{startUrl}add-bonus"
		variant={page.url.pathname === `${startUrl}add-bonus` ? 'default' : 'outline'}
		><Plus /> Add Bonus</Button
	>
	<Button
		href="{startUrl}add-deduction"
		variant={page.url.pathname === `${startUrl}add-deduction` ? 'default' : 'outline'}
		><Plus /> Add Deduction</Button
	>

	<Button
		href="{startUrl}add-overtime"
		variant={page.url.pathname === `${startUrl}add-overtime` ? 'default' : 'outline'}
		><Plus /> Add Overtime</Button
	>
	<Button
		href="{startUrl}change-salary"
		variant={page.url.pathname === `${startUrl}change-salary` ? 'default' : 'outline'}
		><Pen /> Change Salary, Site, Department or Position</Button
	>
	<Button
		href="{startUrl}salary-history"
		variant={page.url.pathname === `${startUrl}salary-history` ? 'default' : 'outline'}
		><Sheet /> Salary, Site, Department & Position History</Button
	>
</div>

{@render children()}
