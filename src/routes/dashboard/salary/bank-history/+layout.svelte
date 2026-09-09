<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';

	import { Plus, Sheet } from '@lucide/svelte';
	let { children } = $props();
</script>

<div class="mb-8 flex flex-row flex-wrap items-center justify-start gap-2">
	<!-- <Button
		href="/dashboard/transactions/expenses/add-expense"
		variant={page.url.pathname === '/dashboard/transactions/expenses/add-expense'
			? 'default'
			: 'outline'}><Plus /> Add Expense</Button
	> -->
	<Button
		href="/dashboard/salary/transactions/expenses"
		variant={page.url.pathname.startsWith('/dashboard/salary/transactions/expenses') &&
		!page.url.pathname.includes('add') &&
		!page.url.pathname.includes('categories')
			? 'default'
			: 'outline'}><Sheet /> Expenses</Button
	>
	<Button
		href="/dashboard/salary/transactions/expenses/add-expense"
		variant={page.url.pathname === '/dashboard/salary/transactions/expenses/add-expense'
			? 'default'
			: 'outline'}><Plus /> Add Expense</Button
	>
	<Button
		href="/dashboard/salary/transactions/expenses/categories"
		variant={page.url.pathname === '/dashboard/salary/transactions/expenses/categories'
			? 'default'
			: 'outline'}><Sheet /> Expense Categories</Button
	>
</div>

{@render children()}
