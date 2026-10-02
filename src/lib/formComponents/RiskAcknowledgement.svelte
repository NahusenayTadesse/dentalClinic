<script lang="ts">
	import { Checkbox } from '@nahu/admin-kit/components/ui/checkbox/index.js';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	/**
	 * A warning the user has to accept before a risky entry goes through.
	 *
	 * Used where the app warns rather than refuses: a money entry it cannot verify (these
	 * balances are a bookkeeping aid, not a link to a real bank), and a prescription that clashes
	 * with an allergy on the chart, which a clinician may knowingly write.
	 *
	 * `checked` is bound to the form's boolean field; the same field is re-checked
	 * on the server, because a hidden checkbox is UX, not a control.
	 */
	let {
		show = false,
		title = 'Check this before you continue',
		message = '',
		name = 'acknowledgeRisk',
		confirmLabel = 'I understand the risks',
		checked = $bindable(false)
	}: {
		/** Only render when the entry is actually risky. */
		show?: boolean;
		title?: string;
		message?: string;
		/** Form field name posted alongside the rest of the form. */
		name?: string;
		/** What ticking the box says — a prescriber confirming an allergy is not taking a money risk. */
		confirmLabel?: string;
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
			{confirmLabel}
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
