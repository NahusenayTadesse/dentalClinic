<script lang="ts">
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { BadgeCheck, ArrowRight } from '@lucide/svelte';
	import { page } from '$app/state';
	import { canVisit } from '$lib/routeAccess';

	let { data } = $props();

	// Seeing what is waiting takes `approvals.view`; opening the queue that settles it takes
	// `approvals.approve`, so a viewer is not offered a link the click would refuse.
	let permList = $derived((page.data.permList ?? []) as string[]);
	let queues = $derived(
		data.queues.filter((q) => canVisit(`/dashboard/approvals/${q.key}`, permList))
	);

	let total = $derived(data.queues.reduce((sum, q) => sum + q.pending, 0));
	let waiting = $derived(queues.filter((q) => q.pending > 0));
	let clear = $derived(queues.filter((q) => q.pending === 0));
</script>

<svelte:head>
	<title>Approvals</title>
</svelte:head>

<div
	class="mx-auto my-4 max-w-4xl rounded-lg bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:bg-gray-800/80"
>
	<h2 class="text-lg font-semibold text-gray-900 lg:text-2xl dark:text-gray-100">
		{#if total === 0}
			Nothing is waiting for approval
		{:else}
			{total} record{total === 1 ? '' : 's'} waiting for approval
		{/if}
	</h2>
	<p class="mt-1 text-sm text-muted-foreground">
		Records are entered by one person and released by another. You cannot approve what you requested
		yourself unless you hold the override permission.
	</p>
</div>

<div class="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
	{#each waiting as queue (queue.key)}
		<a
			href="/dashboard/approvals/{queue.key}"
			class="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:border-gray-700 dark:bg-gray-800"
		>
			<div>
				<p class="font-semibold text-gray-900 dark:text-gray-100">{queue.label}</p>
				<p class="text-sm text-muted-foreground">
					{queue.pending} waiting
				</p>
			</div>
			<ArrowRight class="h-5 w-5 shrink-0 opacity-60" />
		</a>
	{/each}
</div>

{#if clear.length > 0}
	<div class="mx-auto mt-8 max-w-4xl">
		<h3 class="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
			Nothing waiting
		</h3>
		<div class="grid gap-2 sm:grid-cols-2">
			{#each clear as queue (queue.key)}
				<a
					href="/dashboard/approvals/{queue.key}"
					class="flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-muted-foreground hover:border-gray-200 hover:text-foreground dark:hover:border-gray-700"
				>
					<BadgeCheck class="h-4 w-4 shrink-0 opacity-70" />
					{queue.label}
				</a>
			{/each}
		</div>
	</div>
{/if}
