<script lang="ts">
	import Send from '@lucide/svelte/icons/send';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	/** An account row's buttons: send a test through it, and — for a super admin — edit it. */
	let { canEdit, onedit, ontest }: { canEdit: boolean; onedit: () => void; ontest: () => void } =
		$props();
</script>

<div class="flex justify-end gap-1">
	<Button variant="ghost" size="sm" onclick={ontest}><Send class="size-4" /> Test</Button>
	{#if canEdit}
		<Button variant="ghost" size="sm" onclick={onedit}><SquarePen class="size-4" /> Edit</Button>
	{/if}
</div>
