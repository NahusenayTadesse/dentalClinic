<script lang="ts">
	import type { Snippet } from 'svelte';
	import Printer from '@lucide/svelte/icons/printer';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	/**
	 * A document the clinic hands over on paper — a treatment quote, a bill — with its letterhead and
	 * a print button that does not print.
	 *
	 * Rendered by pages outside the dashboard layout (`+page@.svelte`), so they print as a page and
	 * not as a screenshot of the app. The letterhead is the branch the document came from — the
	 * clinic, never the software. Began as the quote's own markup; the bill was its second use.
	 */
	let {
		branch,
		children
	}: {
		branch: { name: string | null; address: string | null; phone: string | null };
		children: Snippet;
	} = $props();
</script>

<main class="mx-auto flex max-w-3xl flex-col gap-6 bg-background p-8 text-foreground print:p-0">
	<div class="flex justify-end print:hidden">
		<Button onclick={() => window.print()}><Printer class="size-4" /> Print</Button>
	</div>

	<header class="flex flex-col gap-1 border-b pb-4">
		<p class="text-2xl font-bold">{branch.name ?? 'Dental clinic'}</p>
		{#if branch.address}<p class="text-sm">{branch.address}</p>{/if}
		{#if branch.phone}<p class="text-sm">Tel. {branch.phone}</p>{/if}
	</header>

	{@render children()}
</main>

<style>
	/* Print only (CLAUDE.md §7): the page margin is not something Tailwind can say. */
	@page {
		margin: 18mm;
	}
</style>
