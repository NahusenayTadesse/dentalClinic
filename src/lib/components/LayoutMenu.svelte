<script module lang="ts">
	import type { Component } from 'svelte';
	import type { IconProps } from '@lucide/svelte';

	export type MenuItem = {
		title: string;
		href: string;
		IconComp?: Component<IconProps>;
		/** Red styling, for the lists nobody should land on by accident. */
		tone?: 'destructive';
		/**
		 * How the button decides it is the current page. `exact` is the default; `prefix` covers
		 * a section with pages under it. Anything stranger takes a predicate.
		 */
		match?: 'exact' | 'prefix' | ((pathname: string) => boolean);
	};
</script>

<script lang="ts">
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';
	import { canVisit } from '$lib/routeAccess';

	let {
		items,
		class: className = ''
	}: {
		items: MenuItem[];
		class?: string;
	} = $props();

	// The permission list rides down from the dashboard layout load, so a menu never needs it
	// threaded through as a prop.
	let permList = $derived((page.data.permList ?? []) as string[]);

	// The same rule the server gate applies: if the click would 403, the button is not drawn.
	let visible = $derived(items.filter((item) => canVisit(item.href, permList)));

	function isActive(item: MenuItem): boolean {
		const path = page.url.pathname;
		if (typeof item.match === 'function') return item.match(path);
		if (item.match === 'prefix') return path.startsWith(item.href);
		return path === item.href;
	}
</script>

{#if visible.length > 0}
	<div class="mb-8 flex flex-row flex-wrap items-center justify-start gap-2 {className}">
		{#each visible as item (item.href)}
			{@const active = isActive(item)}
			<Button
				href={item.href}
				variant={active ? (item.tone === 'destructive' ? 'destructive' : 'default') : 'outline'}
				class={!active && item.tone === 'destructive' ? 'text-destructive' : ''}
				aria-current={active ? 'page' : undefined}
			>
				{#if item.IconComp}
					<item.IconComp />
				{/if}
				{item.title}
			</Button>
		{/each}
	</div>
{/if}
