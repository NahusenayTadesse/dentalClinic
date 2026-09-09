<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { TriangleAlert } from '@lucide/svelte';

	/**
	 * A warning the user has to accept before a risky money entry goes through.
	 *
	 * Used where the app cannot actually verify the money — these balances are a
	 * bookkeeping aid, not a link to a real bank — so it warns and asks for an
	 * explicit acknowledgement rather than refusing.
	 *
	 * `checked` is bound to the form's boolean field; the same field is re-checked
	 * on the server, because a hidden checkbox is UX, not a control.
	 */
	let {
		show = false,
		title = 'Check this before you continue',
		message = '',
		name = 'acknowledgeRisk',
		checked = $bindable(false)
	}: {
		/** Only render when the entry is actually risky. */
		show?: boolean;
		title?: string;
		message?: string;
		/** Form field name posted alongside the rest of the form. */
		name?: string;
		checked?: boolean;
	} = $props();
</script>

{#if show}
	<div
		class="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3"
		role="alert"
	>
		<p class="flex items-center gap-2 text-sm font-semibold text-destructive">
			<TriangleAlert class="size-4 shrink-0" />
			{title}
		</p>
		{#if message}
			<p class="text-sm text-muted-foreground">{message}</p>
		{/if}
		<label class="mt-1 flex items-center gap-2 text-sm font-medium">
			<Checkbox bind:checked aria-label={title} />
			I understand the risks
		</label>
		<!--
			Rendered only when ticked, never as value="false". A string "false" is
			truthy, so a field that is always present is one coercion away from
			reading as acknowledged; absent-means-no cannot go wrong that way.
		-->
		{#if checked}
			<input type="hidden" {name} value="true" />
		{/if}
	</div>
{/if}
