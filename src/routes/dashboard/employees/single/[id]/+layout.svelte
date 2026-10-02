<script lang="ts">
	import { page } from '$app/state';
	import Button from '@nahu/admin-kit/components/ui/button/button.svelte';

	import Pen from '@lucide/svelte/icons/pen';
	import Plus from '@lucide/svelte/icons/plus';
	import Sheet from '@lucide/svelte/icons/sheet';
	import { ledgerHref, type LedgerKind } from '$lib/payrollLedger';
	let { children } = $props();
	const startUrl = $derived(`/dashboard/employees/single/${page.params.id}/salary/`);
	/** Pay adjustments are recorded on their ledger, opened on this employee (`payrollLedger.ts`). */
	const ledgerFor = (kind: LedgerKind) =>
		`${ledgerHref(kind)}?staffId=${encodeURIComponent(page.params.id ?? '')}`;
</script>

<div class="mb-8 flex flex-row flex-wrap items-center justify-start gap-2">
	<Button href={ledgerFor('bonuses')} variant="outline"><Plus /> Add Bonus</Button>
	<Button href={ledgerFor('deductions')} variant="outline"><Plus /> Add Deduction</Button>
	<Button href={ledgerFor('overtime')} variant="outline"><Plus /> Add Overtime</Button>
	<Button
		href="{startUrl}change-salary"
		variant={page.url.pathname === `${startUrl}change-salary` ? 'default' : 'outline'}
		><Pen /> Change Salary, Branch, Department or Position</Button
	>
	<Button
		href="{startUrl}salary-history"
		variant={page.url.pathname === `${startUrl}salary-history` ? 'default' : 'outline'}
		><Sheet /> Salary, Branch, Department & Position History</Button
	>
</div>

{@render children()}
