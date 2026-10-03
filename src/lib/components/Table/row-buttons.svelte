<script lang="ts">
	import type { Component } from 'svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	/**
	 * A table row's own buttons — Edit, Test, Check — right-aligned in their cell. For a row whose
	 * actions open a dialog on the page, rather than going to a page of their own (a link cell is
	 * `data-table-links`). A button the viewer may not use is left out of `buttons`, not disabled.
	 */
	let {
		buttons
	}: {
		buttons: { label: string; icon: Component; onclick: () => void }[];
	} = $props();
</script>

<div class="flex justify-end gap-1">
	{#each buttons as button (button.label)}
		<Button variant="ghost" size="sm" onclick={button.onclick}>
			<button.icon class="size-4" />
			{button.label}
		</Button>
	{/each}
</div>
