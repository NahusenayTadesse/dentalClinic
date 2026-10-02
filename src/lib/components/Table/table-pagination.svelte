<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import * as Select from '@nahu/admin-kit/components/ui/select/index.js';

	/**
	 * The pager, for both modes.
	 *
	 * It is deliberately dumb: it renders a position and reports where the user wants to go. In
	 * client mode the caller moves TanStack's own page index; in server mode the caller writes the
	 * URL and the next load returns a different page. Neither is visible from here, which is what
	 * stops the two drifting into separate pagers that behave differently.
	 *
	 * `total` is rows, not pages — a clinic asking "how many patients" should be able to read the
	 * answer off the bottom of the list rather than multiplying.
	 */
	let {
		page,
		pageSize,
		total,
		pageSizes = [10, 20, 50, 100],
		onPage,
		onPageSize
	}: {
		/** One-based, because that is what the URL and the user both use. */
		page: number;
		pageSize: number;
		total: number;
		pageSizes?: number[];
		onPage: (page: number) => void;
		onPageSize: (size: number) => void;
	} = $props();

	const pageCount = $derived(Math.max(1, Math.ceil(total / Math.max(1, pageSize))));
	const first = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
	const last = $derived(Math.min(page * pageSize, total));
</script>

<div class="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-xs">
	<p class="text-muted-foreground">
		{#if total === 0}
			No rows
		{:else}
			{first.toLocaleString()}–{last.toLocaleString()} of
			<span class="font-medium text-foreground">{total.toLocaleString()}</span>
		{/if}
	</p>

	<div class="flex items-center gap-2">
		<Select.Root
			type="single"
			value={String(pageSize)}
			onValueChange={(v) => v && onPageSize(Number(v))}
		>
			<Select.Trigger class="h-7 w-[4.5rem] text-xs" aria-label="Rows per page">
				{pageSize}
			</Select.Trigger>
			<Select.Content>
				{#each pageSizes as size (size)}
					<Select.Item value={String(size)}>{size}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<span class="px-1 text-muted-foreground">
			Page {page.toLocaleString()} of {pageCount.toLocaleString()}
		</span>

		<Button
			variant="outline"
			size="icon"
			class="size-7"
			aria-label="Previous page"
			disabled={page <= 1}
			onclick={() => onPage(page - 1)}
		>
			<ChevronLeft class="size-4" />
		</Button>
		<Button
			variant="outline"
			size="icon"
			class="size-7"
			aria-label="Next page"
			disabled={page >= pageCount}
			onclick={() => onPage(page + 1)}
		>
			<ChevronRight class="size-4" />
		</Button>
	</div>
</div>
