<script>
	import * as Command from '$lib/components/ui/command/index.js';
	import { Disc, Search } from '@lucide/svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	let isOpen = $state(false);
	let list = [
		{ label: 'Dashboard', path: '/dashboard' },

		// Customers & Sites
		{ label: 'Customers', path: '/dashboard/customers' },

		{ label: 'Sites', path: '/dashboard/sites' },

		// Employees
		{ label: 'Active Employees', path: '/dashboard/employees' },
		{ label: 'Employees Site List', path: '/dashboard/employees/sites' },

		{ label: 'Add Employee', path: '/dashboard/employees/add-employee' },
		{ label: 'Inactive Employees', path: '/dashboard/employees/inactive' },
		{ label: 'Employee Leaves', path: '/dashboard/employees/leaves' },
		{ label: 'Pending Leaves', path: '/dashboard/employees/leaves/pending' },
		{ label: 'Approved Leaves', path: '/dashboard/employees/leaves/approved' },
		{ label: 'Cancelled Leaves', path: '/dashboard/employees/leaves/cancelled' },

		// Inventory & Services
		{ label: 'Services', path: '/dashboard/services' },
		{ label: 'Supplies', path: '/dashboard/supplies' },
		{ label: 'Suppliers', path: '/dashboard/supplies/suppliers' },

		// Finance & Payroll
		{ label: 'Paid Salaries', path: '/dashboard/salary' },
		{ label: 'Unpaid Salaries', path: '/dashboard/salary/add-payroll' },
		{ label: 'Pensions', path: '/dashboard/salary/pensions' },
		{ label: 'Tax Types', path: '/dashboard/salary/tax-types' },
		{ label: 'Transactions', path: '/dashboard/salary/transactions' },
		{ label: 'Expenses', path: '/dashboard/salary/transactions/expenses' },
		{ label: 'Bank History', path: '/dashboard/salary/bank-history' },

		// Miscellaneous
		{ label: 'Reports', path: '/dashboard/reports' },

		//Admin Panel
		{ label: 'Cities', path: '/dashboard/admin-panel/cities' },
		{ label: 'Departments', path: '/dashboard/admin-panel/department' },
		{ label: 'Educational Levels', path: '/dashboard/admin-panel/educational-level' },
		{ label: 'Employment Status', path: '/dashboard/admin-panel/employment-status' },
		{ label: 'Leave Types', path: '/dashboard/admin-panel/leave-types' },
		{
			label: 'Annual Leave Entitlements',
			path: '/dashboard/admin-panel/annual-leave-entitlements'
		},
		{ label: 'Leave Expiry Policy', path: '/dashboard/admin-panel/leave-expiry-policy' },
		{ label: 'Run Leave Accrual', path: '/dashboard/admin-panel/leave-accrual' },
		{ label: 'Payment Methods', path: '/dashboard/admin-panel/payment-methods' },
		{ label: 'Regions', path: '/dashboard/admin-panel/regions' },
		{ label: 'Roles', path: '/dashboard/admin-panel/roles' },
		{ label: 'Services Categories', path: '/dashboard/admin-panel/services/categories' },
		{ label: 'Sub-cities', path: '/dashboard/admin-panel/subcities' },
		{ label: 'Tax Types', path: '/dashboard/admin-panel/tax-types' },
		{ label: 'Overtime Types', path: '/dashboard/admin-panel/overtime-types' },
		{ label: 'Pensions', path: '/dashboard/admin-panel/pensions' },
		{ label: 'Vat and Withhold Percentage', path: '/dashboard/admin-panel/vat-withhold' },
		{ label: 'Bank Amounts', path: '/dashboard/admin-panel/bank-amounts' }
	];
</script>

<DialogComp title="Search the Whole Site" variant="ghost" bind:open={isOpen}>
	{#snippet trigger(props)}
		<Button size="sm" variant="ghost" class="w-auto px-4" title="Search for Pages" {...props}>
			<Search />
		</Button>
	{/snippet}
	<Command.Root class="rounded-lg shadow-md md:min-w-112.5">
		<Command.Input placeholder="Type a command or search..." type="search" />
		<Command.List>
			<Command.Empty>No results found.</Command.Empty>
			<Command.Group heading="Suggestions">
				{#each list as item (item.path)}
					<Command.Item>
						<Disc />
						<a href={item.path} onclick={() => (isOpen = false)}>{item.label}</a>
					</Command.Item>
				{/each}
			</Command.Group>
		</Command.List>
	</Command.Root>
</DialogComp>
