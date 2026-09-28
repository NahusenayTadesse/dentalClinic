<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { INVOICE_STATUS_LABEL, type InvoiceStatus } from '$lib/invoiceStatus';

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

	const tone: Partial<Record<InvoiceStatus, string>> = {
		issued: 'bg-amber-500 text-white',
		partly: 'bg-amber-500/20 text-foreground',
		paid: 'bg-primary text-primary-foreground'
	};
</script>

{#if approvalStatus === 'pending' && status !== 'void'}
	<Badge variant="outline" class="border-amber-500">Awaiting a manager</Badge>
{:else}
	<Badge variant={tone[status] ? 'default' : 'outline'} class={tone[status] ?? ''}>
		{INVOICE_STATUS_LABEL[status]}
	</Badge>
{/if}
