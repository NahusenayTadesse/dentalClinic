<script lang="ts" generics="T extends { allocations: { invoiceId: number; amount: number }[] }">
	import type { SuperFormData } from 'sveltekit-superforms/client';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	/**
	 * How much of a payment goes to each bill: one amount per payable bill, with "pay everything".
	 * Shared by the desk's payment form (`PaymentForm`) and the online one (`OnlinePaymentForm`),
	 * so the two cannot come to split money differently. Writes `allocations` on the caller's form;
	 * the server checks each amount again against what the bill still owes.
	 */
	let {
		form,
		bills
	}: {
		form: SuperFormData<T>;
		bills: {
			id: number;
			number: string | null;
			owed: number;
			issuedOn: string;
			/** Whose bill it is, when the list spans patients. */
			who?: string;
		}[];
	} = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.pay);

	// One allocation per payable bill, starting at nothing, whenever the list of bills changes.
	$effect(() => {
		const ids = bills.map((b) => b.id);
		form.update(
			(f) => ({
				...f,
				allocations: ids.map(
					(id) => f.allocations.find((a) => a.invoiceId === id) ?? { invoiceId: id, amount: 0 }
				)
			}),
			{ taint: false }
		);
	});

	function payEverything() {
		form.update((f) => ({
			...f,
			allocations: bills.map((b) => ({ invoiceId: b.id, amount: b.owed }))
		}));
	}

	function setAmount(invoiceId: number, raw: string) {
		const amount = Number(raw) || 0;
		form.update((f) => ({
			...f,
			allocations: f.allocations.map((a) => (a.invoiceId === invoiceId ? { ...a, amount } : a))
		}));
	}
</script>

{#if bills.length > 1}
	<Button type="button" variant="outline" size="sm" class="self-start" onclick={payEverything}>
		{w.payEverything(formatETB(bills.reduce((s, b) => s + b.owed, 0)))}
	</Button>
{/if}

<ul class="flex flex-col divide-y rounded-md border">
	{#each bills as bill (bill.id)}
		{@const allocated = $form.allocations.find((a) => a.invoiceId === bill.id)}
		<li class="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
			<span class="flex-1">
				{bill.number ?? w.bill}
				{#if bill.who}<span class="font-medium">· {bill.who}</span>{/if}
				<span class="text-muted-foreground">
					· {formatEthiopianDate(new Date(bill.issuedOn))} · {w.owes(formatETB(bill.owed))}
				</span>
			</span>
			<Input
				type="number"
				min="0"
				step="0.01"
				max={bill.owed}
				class="w-32 text-right"
				aria-label={w.amountToward(bill.number ?? w.thisBill)}
				value={allocated?.amount || ''}
				oninput={(e) => setAmount(bill.id, e.currentTarget.value)}
			/>
			{#if bills.length === 1}
				<Button type="button" variant="ghost" size="sm" onclick={payEverything}>{w.allOfIt}</Button>
			{/if}
		</li>
	{/each}
</ul>
