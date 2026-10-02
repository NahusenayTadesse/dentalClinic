<script lang="ts">
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import type { InvoiceStatus } from '$lib/invoiceStatus';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	/**
	 * A bill's status — the same on the patient's billing tab, a bill's page and the billing hub.
	 *
	 * Colour only where it asks for something (CLAUDE.md §7): money owed is amber, a bill waiting for
	 * a manager says so in amber outline — nobody can take its payment until someone decides — and
	 * settled, draft and void are quiet.
	 */
	let {
		status,
		approvalStatus = 'approved'
	}: { status: InvoiceStatus; approvalStatus?: 'pending' | 'approved' | 'rejected' } = $props();

	// The words come from the viewer's language; `INVOICE_STATUS_LABEL` stays the English the server
	// and the rules read.
	const t = useI18n();
	const label = $derived(t.m.billing.status);

	const tone: Partial<Record<InvoiceStatus, string>> = {
		issued: 'bg-amber-500 text-white',
		partly: 'bg-amber-500/20 text-foreground',
		paid: 'bg-primary text-primary-foreground'
	};
</script>

{#if approvalStatus === 'pending' && status !== 'void'}
	<Badge variant="outline" class="border-amber-500">{label.awaitingManager}</Badge>
{:else}
	<Badge variant={tone[status] ? 'default' : 'outline'} class={tone[status] ?? ''}>
		{label[status]}
	</Badge>
{/if}
