<script lang="ts">
	import { TriangleAlert, CircleX } from '@lucide/svelte';
	import { formatEthiopianDate } from '$lib/global.svelte.js';

	let {
		status,
		employee,
		requestedBy = null,
		rejectedBy = null,
		rejectedAt = null,
		rejectionReason = null
	}: {
		status: 'pending' | 'approved' | 'rejected' | null | undefined;
		employee: string;
		requestedBy?: string | null;
		rejectedBy?: string | null;
		rejectedAt?: Date | string | null;
		rejectionReason?: string | null;
	} = $props();

	let rejected = $derived(status === 'rejected');
	let rejectedOn = $derived(rejectedAt ? formatEthiopianDate(new Date(rejectedAt)) : '');
</script>

{#if status && status !== 'approved'}
	<div
		role="alert"
		class="mb-6 rounded-lg border-2 p-6 {rejected
			? 'border-red-500/60 bg-red-500/10'
			: 'border-amber-500/60 bg-amber-500/10'}"
	>
		<h2 class="flex items-center gap-3 text-xl font-bold sm:text-2xl">
			{#if rejected}
				<CircleX class="size-7 shrink-0 text-red-500" />
				This employee was rejected
			{:else}
				<TriangleAlert class="size-7 shrink-0 text-amber-500" />
				This employee has not been approved
			{/if}
		</h2>

		<p class="mt-3 text-base sm:text-lg">
			{employee}
			{rejected
				? 'was rejected and is not part of the workforce.'
				: 'is still waiting for approval.'}
			They will <span class="font-semibold">not be included in salary calculations</span>
			until the record is approved.
		</p>

		{#if rejected}
			<div class="mt-4 rounded-md border border-red-500/40 bg-background/60 p-4">
				<p class="text-sm font-semibold tracking-wide uppercase">Reason for rejection</p>
				<p class="mt-1 text-base">
					{rejectionReason || 'No reason was recorded.'}
				</p>
				{#if rejectedBy || rejectedOn}
					<p class="mt-2 text-sm text-muted-foreground">
						Rejected {rejectedBy ? `by ${rejectedBy}` : ''}
						{rejectedOn ? `on ${rejectedOn}` : ''}
					</p>
				{/if}
			</div>
		{:else if requestedBy}
			<p class="mt-3 text-sm text-muted-foreground">
				Requested by {requestedBy}.
			</p>
		{/if}
	</div>
{/if}
