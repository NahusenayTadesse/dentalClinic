<script lang="ts">
	import { page } from '$app/state';
	import {
		Calendar,
		Container,
		LayoutDashboard,
		ShoppingBasket,
		SquareChartGantt,
		UsersRound
	} from '@lucide/svelte';

	const mobNav = [
		{ title: 'Dashboard', url: '/dashboard/', icon: LayoutDashboard },
		{ title: 'Customers', url: '/dashboard/appointments', icon: UsersRound },
		{ title: 'Service', url: '/dashboard/services', icon: SquareChartGantt },
		{ title: 'Supplies', url: '/dashboard/supplies', icon: Container }
	];

	const on = 'text-primary shadow-lg shadow-primary/20 bg-primary/10';
	const off = 'text-muted-foreground hover:text-foreground hover:bg-muted/50';
	function blacken(url: string) {
		const currentPath = page.url.pathname;

		// Special case for root dashboard
		if (url === '/dashboard/') {
			return currentPath === '/dashboard' ? on : off;
		}

		// For other items, check if current path starts with their URL but is not just /dashboard
		return currentPath.startsWith(url) && currentPath !== '/dashboard' ? on : off;
	}
</script>

<nav
	class="fixed right-0 bottom-0 left-0 z-40 flex w-screen border-t border-border/50 bg-gradient-to-t from-background via-background/95 to-background/80 backdrop-blur-xl lg:hidden"
>
	<div class="grid grid-cols-5 items-center justify-around px-2 py-3">
		{#each mobNav as item (item.url)}
			<a
				href={item.url}
				class="group relative flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-300 ease-out hover:scale-110 active:scale-95 {blacken(
					item.url
				)}"
				title={item.title}
			>
				<div
					class="relative flex h-6 w-6 items-center justify-center transition-all duration-300 {on
						? 'drop-shadow-lg'
						: ''}"
				>
					<item.icon class="!h-4 !w-4" />
					<!-- {#if on}
						<div
							class="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 animate-pulse rounded-full bg-primary"
							transition:scale={{ duration: 200 }}
						></div>
					{/if} -->
				</div>

				<!-- Label -->
				<span
					class="text-xs leading-none font-medium whitespace-nowrap transition-all duration-300"
				>
					{item.title}
				</span>

				<!-- Hover glow effect -->
				{#if off}
					<div
						class="absolute inset-0 -z-10
					rounded-xl bg-gradient-to-t from-primary/0 to-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
					></div>
				{/if}
			</a>
		{/each}
	</div>
</nav>
