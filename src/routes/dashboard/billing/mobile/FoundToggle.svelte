<script lang="ts">
	import { enhance } from '$app/forms';
	import Check from '@lucide/svelte/icons/check';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { clinicClock } from '$lib/clinicTime';

	/** A transfer's tick: who found it on the statement and when, or the button that says so. */
	let {
		id,
		reconciledAt,
		reconciledBy,
		canCheck
	}: {
		id: number;
		reconciledAt: Date | string | null;
		reconciledBy: string | null;
		canCheck: boolean;
	} = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.mobile);
	let busy = $state(false);
</script>

<div class="flex items-center justify-end gap-2 text-sm">
	{#if reconciledAt}
		<span class="text-muted-foreground"
			>{w.checkedBy(reconciledBy ?? '—', clinicClock(reconciledAt))}</span
		>
	{:else}
		<span class="text-muted-foreground">{w.notChecked}</span>
	{/if}
	{#if canCheck}
		<form
			method="post"
			action="?/reconcile"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}}
		>
			<input type="hidden" name="transactionId" value={id} />
			<input type="hidden" name="found" value={reconciledAt ? 'false' : 'true'} />
			<Button type="submit" size="sm" variant={reconciledAt ? 'ghost' : 'outline'} disabled={busy}>
				{#if !reconciledAt}<Check class="size-4" />{/if}
				{reconciledAt ? w.unmark : w.markFound}
			</Button>
		</form>
	{/if}
</div>
