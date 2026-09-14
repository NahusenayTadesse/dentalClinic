<script>
	import AdminNavCard from '$lib/components/AdminCard.svelte';
	import { Button } from '$lib/components/ui/button';
	let locations = [
		{ name: 'Branches', href: '/dashboard/admin-panel/branches' },
		{ name: 'Regions', href: '/dashboard/admin-panel/regions' },
		{ name: 'Cities', href: '/dashboard/admin-panel/cities' },
		{ name: 'Subcities', href: '/dashboard/admin-panel/subcities' }
	];

	let organization = [
		{ name: 'Departments', href: '/dashboard/admin-panel/department' },
		{ name: 'Positions', href: '/dashboard/admin-panel/positions' },
		{ name: 'Educational Levels', href: '/dashboard/admin-panel/educational-level' },
		{ name: 'Employement Status ', href: '/dashboard/admin-panel/employment-status' },
		{ name: 'Leave Types', href: '/dashboard/admin-panel/leave-types' },
		{ name: 'Annual Leave Entitlements', href: '/dashboard/admin-panel/annual-leave-entitlements' },
		{ name: 'Leave Expiry Policy', href: '/dashboard/admin-panel/leave-expiry-policy' },
		{ name: 'Run Leave Accrual', href: '/dashboard/admin-panel/leave-accrual' },
		{ name: 'Services', href: '/dashboard/admin-panel/services' }
	];

	let userManagement = [
		{ name: 'Users', href: '/dashboard/admin-panel/users' },
		{ name: 'Roles', href: '/dashboard/admin-panel/roles' }
	];
	let finance = [
		{ name: 'Specialties', href: '/dashboard/admin-panel/specialties' },
		{ name: 'Dental Labs', href: '/dashboard/admin-panel/dental-labs' },
		{ name: 'Closures', href: '/dashboard/admin-panel/closures' },
		{ name: 'Appointment Types', href: '/dashboard/admin-panel/appointment-types' },
		{ name: 'Chairs', href: '/dashboard/admin-panel/chairs' },
		{ name: 'Referral Sources', href: '/dashboard/admin-panel/referral-sources' },
		{ name: 'Conditions', href: '/dashboard/admin-panel/conditions' },
		{ name: 'Allergens', href: '/dashboard/admin-panel/allergens' },
		{ name: 'Contact Types', href: '/dashboard/admin-panel/contact-types' },
		{ name: 'Payment Methods', href: '/dashboard/admin-panel/payment-methods' },
		{ name: 'Tax Types', href: '/dashboard/admin-panel/tax-types' },
		{ name: 'Overtime Types', href: '/dashboard/admin-panel/overtime-types' },
		{ name: 'Pensions', href: '/dashboard/admin-panel/pensions' },
		{ name: 'Vat and Withhold', href: '/dashboard/admin-panel/vat-withhold' }
	];
</script>

<svele:head>
	<title>Admin Panel</title>
</svele:head>

<div class="min-h-dvh w-full text-foreground transition-colors duration-300">
	<!-- Header -->

	<!-- Main Content -->
	<main class="mx-auto max-w-7xl px-6 py-12">
		<!-- Hero Section -->
		<div class="mb-16 flex flex-col gap-4">
			<h2 class="text-4xl font-bold tracking-tight">Welcome to Admin Dashboard</h2>
			<p class="max-w-2xl text-lg text-muted-foreground">
				Manage locations, organizational structure, and user access. Select a category below to get
				started.
			</p>
		</div>

		<!-- Navigation Cards Grid -->
		<div class="grid gap-8 md:grid-cols-4">
			<AdminNavCard
				title="Locations"
				description="Clinic branches, and the regions, cities and subcities addresses are built from"
				icon="MapPin"
				items={locations}
			/>

			<AdminNavCard
				title="Organization"
				description="Configure departments and payment methods"
				icon="Building2"
				items={organization}
			/>

			<AdminNavCard
				title="User Management"
				description="Control users and their assigned roles"
				icon="Users"
				items={userManagement}
			/>

			<AdminNavCard
				title="Finance"
				description="Control users and their assigned roles"
				icon="BankNote"
				items={finance}
			/>
		</div>
	</main>

	<!-- Footer -->
	<!-- <footer class="mt-16 border-t border-border/50 bg-card/50 py-8">
		<div class="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
			<p>© {new Date().getFullYear()} amno ERP Solutions. All rights reserved.</p>
		</div>
	</footer> -->
</div>
