<script lang="ts">
	import { CircleX, ArrowRight } from '@lucide/svelte';

	let { data } = $props();

	let total = $derived(data.queues.reduce((sum, q) => sum + q.rejected, 0));
	let held = $derived(data.queues.filter((q) => q.rejected > 0));
	let clear = $derived(data.queues.filter((q) => q.rejected === 0));
</script>

<svelte:head>
	<title>Rejections</title>
</svelte:head>

<div
	class="mx-auto my-4 max-w-4xl rounded-lg bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:bg-gray-800/80"
>
	<h2 class="text-lg font-semibold text-gray-900 lg:text-2xl dark:text-gray-100">
		{#if total === 0}
			Nothing has been rejected
		{:else}
			{total} rejected record{total === 1 ? '' : 's'}
		{/if}
	</h2>
	<p class="mt-1 text-sm text-muted-foreground">
		A rejected record stays out of every list and every calculation until it is dealt with. Send one
		back for approval once its reason has been addressed — it returns to the queue with the
		rejection cleared.
	</p>
</div>

<div class="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
	{#each held as queue (queue.key)}
		<a
			href="/dashboard/rejections/{queue.key}"
			class="flex items-center justify-between gap-4 rounded-lg border border-red-500/50 bg-red-500/5 p-4 transition-colors hover:border-red-500 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
		>
			<div>
				<p class="font-semibold text-gray-900 dark:text-gray-100">{queue.label}</p>
				<p class="text-sm text-muted-foreground">
					{queue.rejected} rejected
				</p>
			</div>
			<ArrowRight class="h-5 w-5 shrink-0 opacity-60" />
		</a>
	{/each}
</div>

{#if clear.length > 0}
	<div class="mx-auto mt-8 max-w-4xl">
		<h3 class="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
			Nothing rejected
		</h3>
		<div class="grid gap-2 sm:grid-cols-2">
			{#each clear as queue (queue.key)}
				<a
					href="/dashboard/rejections/{queue.key}"
					class="flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-muted-foreground hover:border-gray-200 hover:text-foreground dark:hover:border-gray-700"
				>
					<CircleX class="h-4 w-4 shrink-0 opacity-70" />
					{queue.label}
				</a>
			{/each}
		</div>
	</div>
{/if}
