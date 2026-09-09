<script lang="ts">
	import {
		BadgeCheck,
		Users,
		UserRoundCog,
		ChartArea,
		SquareChartGantt,
		IdCardLanyard,
		LayoutDashboard,
		GraduationCap,
		Container,
		Banknote,
		BanknoteArrowUp,
		ScanLine,
		List,
		FileX,
		FileCheck,
		Plus,
		MapPin,
		Building2,
		Sheet,
		BanknoteArrowDown,
		ScrollText,
		Loader,
		CircleCheckBig,
		OctagonMinus,
		CircleX,
		Coins,
		TreePalm,
		Form,
		Landmark,
		PackagePlus,
		Tags,
		Truck,
		User,
		LifeBuoy
	} from '@lucide/svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { ComponentProps } from 'svelte';
	import { bgGradient } from '$lib/global.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import { canVisit } from '$lib/routeAccess';

	import type { Component } from 'svelte';
	import type { IconProps } from '@lucide/svelte';

	import NavMain from './NavMain.svelte';

	interface NavItem {
		title: string;
		url: string;
		icon: Component<IconProps>;

		items?: NavItem[];
	}

	let {
		permList = [],
		...restProps
	}: { permList: string[]; restProps: ComponentProps<typeof Sidebar.Root> } = $props();

	const navigation: NavItem[] = [
		{ title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },

		{
			title: 'Customers',
			url: '/dashboard/customers',
			icon: Users,
			items: [
				{
					title: 'All Customers',
					url: '/dashboard/customers',
					icon: List
				},
				{
					title: 'Add Customer',
					url: '/dashboard/customers/add-customer',
					icon: Plus
				}
			]
		},

		{
			title: 'Sites',
			url: '/dashboard/sites',
			icon: Building2,
			items: [
				{
					title: 'All Sites',
					url: '/dashboard/sites',
					icon: List
				},
				{
					title: 'Add Site',
					url: '/dashboard/sites/add-site',
					icon: Plus
				}
			]
		},

		{
			title: 'Approvals',
			url: '/dashboard/approvals',
			icon: BadgeCheck,
			items: [
				{
					title: 'All Queues',
					url: '/dashboard/approvals',
					icon: BadgeCheck
				},
				{
					title: 'Employees',
					url: '/dashboard/approvals/employees',
					icon: Loader
				},
				{
					title: 'Salary Changes',
					url: '/dashboard/approvals/salaries',
					icon: Loader
				},
				{
					title: 'Expenses',
					url: '/dashboard/approvals/expenses',
					icon: Loader
				},
				{
					title: 'Payroll Runs',
					url: '/dashboard/approvals/payroll-runs',
					icon: Loader
				}
			]
		},

		{
			title: 'Rejections',
			url: '/dashboard/rejections',
			icon: OctagonMinus,
			items: [
				{
					title: 'All Queues',
					url: '/dashboard/rejections',
					icon: OctagonMinus
				},
				{
					title: 'Employees',
					url: '/dashboard/rejections/employees',
					icon: CircleX
				},
				{
					title: 'Salary Changes',
					url: '/dashboard/rejections/salaries',
					icon: CircleX
				},
				{
					title: 'Expenses',
					url: '/dashboard/rejections/expenses',
					icon: CircleX
				},
				{
					title: 'Payroll Runs',
					url: '/dashboard/rejections/payroll-runs',
					icon: CircleX
				}
			]
		},

		{
			title: 'Employees',
			url: '/dashboard/employees',
			icon: IdCardLanyard,
			items: [
				{
					title: 'Employees by Site',
					url: '/dashboard/employees/sites',
					icon: Building2
				},
				{
					title: 'All Active Employees',
					url: '/dashboard/employees',
					icon: List
				},
				{
					title: 'Add New Employee',
					url: '/dashboard/employees/add-employee',
					icon: Plus
				},
				{
					title: 'Leaves',
					url: '/dashboard/employees/leaves',
					icon: TreePalm
				}
			]
		},

		{
			title: 'Finance',
			url: '/dashboard/salary',
			icon: Banknote,
			items: [
				{
					title: 'Paid Salaries',
					url: '/dashboard/salary/paid-salaries',
					icon: Banknote
				},
				{
					title: 'All UnPaid Salaries',
					url: '/dashboard/salary/add-payroll',
					icon: BanknoteArrowUp
				},
				{
					title: 'UnPaid Salaries by Site',
					url: '/dashboard/salary/add-payroll/sites',
					icon: BanknoteArrowUp
				},
				{
					title: 'All OverTime',
					url: '/dashboard/salary/add-overtime',
					icon: BanknoteArrowUp
				},
				{
					title: 'All Deductions',
					url: '/dashboard/salary/add-deductions',
					icon: BanknoteArrowDown
				},
				{
					title: 'Transactions',
					url: '/dashboard/salary/transactions',
					icon: ScanLine
				},
				{
					title: 'Bank History',
					url: '/dashboard/salary/bank-history',
					icon: Landmark
				}
			]
		},

		{
			title: 'Supplies',
			url: '/dashboard/supplies',
			icon: Container,
			items: [
				{
					title: 'Stock Levels',
					url: '/dashboard/supplies',
					icon: List
				},
				{
					title: 'Add Supply',
					url: '/dashboard/supplies/add-supplies',
					icon: Plus
				},
				{
					title: 'Suppliers',
					url: '/dashboard/supplies/suppliers',
					icon: Sheet
				},
				{
					title: 'Add Supplier',
					url: '/dashboard/supplies/suppliers/add-suppliers',
					icon: Plus
				},
				{
					// Reference data, so it lives in the admin panel with every other
					// lookup table — surfaced here because this is where it is used.
					title: 'Supply Types',
					url: '/dashboard/admin-panel/supply-types',
					icon: Tags
				},
				{
					title: 'Stock Report',
					url: '/dashboard/reports/stock',
					icon: ChartArea
				}
			]
		},

		{
			title: 'Reports',
			url: '/dashboard/reports',
			icon: ChartArea,
			items: [
				{
					title: 'Overview',
					url: '/dashboard/reports',
					icon: LayoutDashboard
				},
				{
					title: 'People',
					url: '/dashboard/reports/people',
					icon: Users
				},
				{
					title: 'Payroll',
					url: '/dashboard/reports/payroll',
					icon: Banknote
				},
				{
					title: 'Compensation',
					url: '/dashboard/reports/compensation',
					icon: Coins
				},
				{
					title: 'Time & Leave',
					url: '/dashboard/reports/leave',
					icon: TreePalm
				},
				{
					title: 'Stock',
					url: '/dashboard/reports/stock',
					icon: Container
				},
				{
					title: 'Money',
					url: '/dashboard/reports/money',
					icon: Landmark
				},
				{
					title: 'Commercial',
					url: '/dashboard/reports/commercial',
					icon: Building2
				},
				{
					title: 'System',
					url: '/dashboard/reports/system',
					icon: ScrollText
				}
			]
		},

		{
			title: 'Admin Panel',
			url: '/dashboard/admin-panel',
			icon: UserRoundCog,
			items: [
				{
					title: 'Admin Panel',
					url: '/dashboard/admin-panel',
					icon: UserRoundCog
				},
				{
					title: 'Regions',
					url: '/dashboard/admin-panel/regions',
					icon: MapPin
				},
				{
					title: 'Cities',
					url: '/dashboard/admin-panel/cities',
					icon: MapPin
				},
				{
					title: 'Subcities',
					url: '/dashboard/admin-panel/subcities',
					icon: MapPin
				},
				{
					title: 'Departments',
					url: '/dashboard/admin-panel/department',
					icon: Building2
				},
				{
					title: 'Positions',
					url: '/dashboard/admin-panel/positions',
					icon: Building2
				},
				{
					title: 'Services',
					url: '/dashboard/admin-panel/services',
					icon: SquareChartGantt
				},
				{
					title: 'Educational Level',
					url: '/dashboard/admin-panel/educational-level',
					icon: GraduationCap
				},
				{
					title: 'Employment Status',
					url: '/dashboard/admin-panel/employment-status',
					icon: IdCardLanyard
				},
				{
					title: 'Leave Types',
					url: '/dashboard/admin-panel/leave-types',
					icon: TreePalm
				},
				{
					title: 'Annual Leave Entitlements',
					url: '/dashboard/admin-panel/annual-leave-entitlements',
					icon: TreePalm
				},
				{
					title: 'Leave Expiry Policy',
					url: '/dashboard/admin-panel/leave-expiry-policy',
					icon: TreePalm
				},
				{
					title: 'Run Leave Accrual',
					url: '/dashboard/admin-panel/leave-accrual',
					icon: TreePalm
				},
				{
					title: 'Users',
					url: '/dashboard/admin-panel/users',
					icon: Users
				},
				{
					title: 'Roles',
					url: '/dashboard/admin-panel/roles',
					icon: Users
				},
				{
					title: 'Payment Methods',
					url: '/dashboard/admin-panel/payment-methods',
					icon: Banknote
				},
				{
					title: 'Tax Types',
					url: '/dashboard/admin-panel/tax-types',
					icon: Banknote
				},
				{
					title: 'Overtime Types',
					url: '/dashboard/admin-panel/overtime-types',
					icon: Banknote
				},
				{
					title: 'Pension',
					url: '/dashboard/admin-panel/pensions',
					icon: BanknoteArrowDown
				},
				{
					title: 'Vat and Withhold',
					url: '/dashboard/admin-panel/vat-withhold',
					icon: Coins
				},
				{
					title: 'Bank Amount',
					url: '/dashboard/admin-panel/bank-amounts',
					icon: Landmark
				}
			]
		},

		// Ungated, so it survives the permission filter for everyone — the one screen
		// a user with no permissions at all can still reach and read.
		{ title: 'Help', url: '/dashboard/help', icon: LifeBuoy }
	];

	const on = 'bg-sidebar-primary text-sidebar-primary-foreground';
	const off = 'text-sidebar-foreground';
	// The same rule the server gate applies, read off the link's own URL. Nothing here names a
	// permission of its own any more, so a menu entry and the gate in front of it cannot drift
	// apart — an ungated URL (the dashboard index) stays open to everyone.
	function hasAccess(item: NavItem): boolean {
		return canVisit(item.url, permList);
	}
	const sidebar = useSidebar();

	function closeSidebar() {
		if (sidebar.isMobile) {
			sidebar.setOpenMobile(false);
		}
	}
	const filteredNavigation = $derived.by(() => {
		return navigation
			.map((item) => {
				// 1. If the user fails the parent-level permission, drop the item instantly
				if (!hasAccess(item)) return null;

				// 2. If it has sub-items, clean and filter them recursively
				if (item.items) {
					const allowedSubItems = item.items.filter(hasAccess);

					// If a parent module has no accessible children left, remove it from view
					if (allowedSubItems.length === 0) return null;

					return { ...item, items: allowedSubItems };
				}

				return item;
			})
			.filter((item): item is NavItem => item !== null);
	});
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
	<Sidebar.Content
		class="z-9999! h-full
  [scrollbar-width:thin] [scrollbar-color:#a3a3a3_transparent]
  overflow-y-scroll
  pt-4
  [&::-webkit-scrollbar]:w-2
  [&::-webkit-scrollbar-thumb]:bg-gray-400
  [&::-webkit-scrollbar-thumb:hover]:bg-gray-500 [&::-webkit-scrollbar-track]:bg-transparent
  {bgGradient}
"
	>
		<Sidebar.Group>
			<Sidebar.GroupLabel>
				<div class="flex flex-row items-center justify-center gap-4">
					<img src="/logo.webp" class="block h-16 w-16 dark:hidden" alt="Logo" />
					<img src="/logoWhite.webp" class="hidden h-16 w-16 dark:block" alt="Logo" />
					<h4 class="text-[22px]! text-gray-900 dark:text-white">Spotless</h4>
				</div></Sidebar.GroupLabel
			>
			<Sidebar.GroupContent class="my-4">
				<NavMain {closeSidebar} items={filteredNavigation} />
				<!-- <Sidebar.Menu class="w-full gap-3">
					{#each navigation as item (item.title)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								class="flex items-center gap-3 rounded-lg px-3 py-5 text-lg
          font-normal transition-colors duration-300 hover:bg-sidebar-accent
          hover:text-sidebar-accent-foreground {selectItem}
          {blacken(item.url)}"
							>
								{#snippet child({ props })}
									<a href={item.url} onclick={closeSidebar} {...props} transition:fade>
										<item.icon class="!h-5 !w-5" />
										<span>{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu> -->
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Footer class="flex flex-row bg-white dark:bg-black">
		<Sidebar.GroupLabel>
			Powered By <a href="https://pulsedata.com" target="_blank" class="ml-1">PulseData</a>
		</Sidebar.GroupLabel>
	</Sidebar.Footer>
</Sidebar.Root>
