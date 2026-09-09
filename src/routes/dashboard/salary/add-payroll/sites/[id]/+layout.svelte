<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';

	import { Calendar, CircleMinus, Clock, Plus, Sheet } from '@lucide/svelte';
	let { children } = $props();
</script>

<div class="mb-8 flex flex-row flex-wrap items-center justify-start gap-2">
	<Button
		href="/dashboard/salary/add-payroll/sites/{page.params.id}/salaries"
		variant={page.url.pathname.startsWith(
			`/dashboard/salary/add-payroll/sites/${page.params.id}/salaries`
		)
			? 'default'
			: 'outline'}
		><Sheet /> Unpaid Salaries
	</Button>

	<Button
		href="/dashboard/salary/add-payroll/sites/{page.params.id}/add-deductions"
		variant={page.url.pathname.startsWith(
			`/dashboard/salary/add-payroll/sites/${page.params.id}/add-deductions`
		)
			? 'default'
			: 'outline'}
		><CircleMinus /> Deductions
	</Button>
	<Button
		href="/dashboard/salary/add-payroll/sites/{page.params.id}/add-overtime"
		variant={page.url.pathname.startsWith(
			`/dashboard/salary/add-payroll/sites/${page.params.id}/add-overtime`
		)
			? 'default'
			: 'outline'}
		><Clock /> Overtime
	</Button>
</div>

{@render children()}
