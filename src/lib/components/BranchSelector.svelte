<script lang="ts">
	import Building2 from '@lucide/svelte/icons/building-2';
	import { invalidateAll } from '$app/navigation';
	import * as Select from '$lib/components/ui/select/index.js';
	import type { BranchContext } from '$lib/server/branchScope';

	/**
	 * Which branch the user is working at, chosen once for the whole app.
	 *
	 * It renders only when there is a genuine choice — one branch, or one branch this user may
	 * see, and the top bar stays as it was. That is the ordinary case and it should cost nothing.
	 *
	 * Switching calls `invalidateAll()` rather than reloading: every loader reads
	 * `locals.branch`, so re-running them is exactly what has to happen, and a full reload would
	 * throw away scroll position and open panels for no gain.
	 */
	let { branch }: { branch: BranchContext | undefined } = $props();

	const ALL = 'all';

	const current = $derived(branch?.active === null ? ALL : String(branch?.active ?? ''));

	const label = $derived(
		branch?.active === null
			? 'All branches'
			: (branch?.options.find((b) => b.id === branch?.active)?.name ?? 'Branch')
	);

	let saving = $state(false);

	async function choose(value: string | undefined) {
		if (!value || value === current || saving) return;

		saving = true;
		try {
			const res = await fetch('/dashboard/branch', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ branchId: value })
			});
			// A refused switch must not leave the selector showing a branch the server rejected.
			if (res.ok) await invalidateAll();
		} finally {
			saving = false;
		}
	}
</script>

{#if branch?.showSelector}
	<Select.Root type="single" value={current} onValueChange={choose}>
		<Select.Trigger class="h-9 w-auto min-w-40 gap-2 text-sm" aria-label="Branch" disabled={saving}>
			<Building2 class="size-4" />
			{label}
		</Select.Trigger>
		<Select.Content>
			{#each branch.options as option (option.id)}
				<Select.Item value={String(option.id)}>{option.name}</Select.Item>
			{/each}
			{#if branch.canSeeAll}
				<Select.Separator />
				<Select.Item value={ALL}>All branches</Select.Item>
			{/if}
		</Select.Content>
	</Select.Root>
{/if}
