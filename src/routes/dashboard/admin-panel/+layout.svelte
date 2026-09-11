<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { selectItem } from '$lib/global.svelte';
	import { ChevronDown } from '@lucide/svelte';
	import { fly, slide } from 'svelte/transition';
	import { page } from '$app/state';
	import { canVisit } from '$lib/routeAccess';

	let { children } = $props();

	// Users and Roles sit behind permissions of their own, so a settings user without them
	// never sees the entries. Same rule as the server gate, so no menu leads to a 403.
	let permList = $derived((page.data.permList ?? []) as string[]);
	const allowed = (list: { name: string; href: string }[]) =>
		list.filter((entry) => canVisit(entry.href, permList));

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

		{ name: 'Services', href: '/dashboard/admin-panel/services' },
		{ name: 'Supply Types', href: '/dashboard/admin-panel/supply-types' }
	];

	let userManagement = [
		{ name: 'Users', href: '/dashboard/admin-panel/users' },
		{ name: 'Roles', href: '/dashboard/admin-panel/roles' }
	];

	let finance = [
		{ name: 'Allergens', href: '/dashboard/admin-panel/allergens' },
		{ name: 'Contact Types', href: '/dashboard/admin-panel/contact-types' },
		{ name: 'Payment Methods', href: '/dashboard/admin-panel/payment-methods' },
		{ name: 'Tax Types', href: '/dashboard/admin-panel/tax-types' },
		{ name: 'Overtime Types', href: '/dashboard/admin-panel/overtime-types' },
		{ name: 'Pensions', href: '/dashboard/admin-panel/pensions' },
		{ name: 'Vat and Withhold', href: '/dashboard/admin-panel/vat-withhold' }
	];
</script>

{#snippet menu(trigger = '', array = [{ name: '', href: '' }])}
	<Menubar.Menu>
		<Menubar.Trigger class={selectItem}>{trigger} <ChevronDown /></Menubar.Trigger>

		<div transition:fly={{ y: 20, duration: 300 }}>
			<Menubar.Content>
				{#each array as menu}
					<Menubar.Item class={selectItem}
						><a href={menu.href} class="w-full" transition:slide|global>{menu.name}</a
						></Menubar.Item
					>
					<Menubar.Separator />
				{/each}
			</Menubar.Content>
		</div>
	</Menubar.Menu>
{/snippet}

<Menubar.Root class="sticky mb-8 bg-transparent">
	{@render menu('Organization', allowed(organization))}
	{@render menu('Locations', allowed(locations))}
	{#if allowed(userManagement).length > 0}
		{@render menu('User Management', allowed(userManagement))}
	{/if}
	{@render menu('Finance', allowed(finance))}
</Menubar.Root>

{@render children?.()}
