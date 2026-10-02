<script lang="ts">
	import Banknote from '@lucide/svelte/icons/banknote';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { payment } from '$lib/forms/payment';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	/**
	 * Taking a payment: an amount against each bill it settles, and how it was paid. Used on a
	 * patient's billing tab (every payable bill listed), on a bill's own page (that one), and on an
	 * employer or insurer's page (their bills, across patients — each named by `who`).
	 *
	 * Posted as JSON — a list of amounts against bills does not survive form fields. The server checks
	 * every amount again against what each bill still owes, and refuses cash while the drawer is shut;
	 * the warning here only says so first.
	 */
	let {
		data,
		bills,
		methods,
		drawerOpen,
		onpaid
	}: {
		data: SuperValidated<Infer<typeof payment>>;
		bills: {
			id: number;
			number: string | null;
			owed: number;
			issuedOn: string;
			/** Whose bill it is, when the list spans patients. */
			who?: string;
		}[];
		methods: { value: number; name: string; kind: string }[];
		drawerOpen: boolean;
		/** Called once a payment has been recorded — a dialog closes itself with it. */
		onpaid?: () => void;
	} = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.pay);

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data, payment, {
		dataType: 'json',
		onUpdated({ form }) {
			if (form.message?.type === 'success') onpaid?.();
		}
	});

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

	const total = $derived($form.allocations.reduce((sum, a) => sum + (a.amount || 0), 0));
	const chosen = $derived(methods.find((m) => String(m.value) === $form.paymentMethodId));
	const methodItems = $derived(
		methods.map((m) => ({
			value: String(m.value),
			name: m.kind === 'cash' ? w.cash(m.name) : m.name
		}))
	);
</script>

<form method="post" action="?/pay" use:enhance class="flex flex-col gap-4">
	<Errors allErrors={$allErrors} />

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
					<Button type="button" variant="ghost" size="sm" onclick={payEverything}
						>{w.allOfIt}</Button
					>
				{/if}
			</li>
		{/each}
	</ul>

	<InputComp
		label={w.paidBy}
		name="paymentMethodId"
		type="select"
		{form}
		{errors}
		items={methodItems}
	/>
	{#if chosen?.kind === 'cash' && !drawerOpen}
		<p class="rounded-md border border-amber-500 p-3 text-sm" role="alert">
			{w.drawerShut}
			<strong>{w.drawerPlace}</strong>
			{w.drawerShutEnd}
		</p>
	{/if}
	<!-- Mobile money must carry its transaction ID: the server refuses without it, and refuses one
	     already used. Other methods may carry a reference. -->
	<InputComp
		label={chosen?.kind === 'mobile' ? w.referenceMobile : w.reference}
		name="reference"
		{form}
		{errors}
		required={chosen?.kind === 'mobile'}
		placeholder={chosen?.kind === 'mobile' ? w.referenceMobilePlaceholder : w.referencePlaceholder}
	/>

	<div class="flex items-center justify-between gap-3">
		<p class="text-sm">
			{w.total} <span class="font-semibold tabular-nums">{formatETB(total)}</span>
		</p>
		<Button type="submit" disabled={$delayed || total <= 0}>
			{#if $delayed}
				<LoadingBtn name={w.recording} />
			{:else}
				<Banknote class="size-4" /> {w.record}
			{/if}
		</Button>
	</div>
</form>
