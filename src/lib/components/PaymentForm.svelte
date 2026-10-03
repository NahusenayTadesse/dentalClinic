<script lang="ts">
	import Banknote from '@lucide/svelte/icons/banknote';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { formatETB } from '$lib/global.svelte';
	import BillAllocations from '$lib/components/BillAllocations.svelte';
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

	<BillAllocations {form} {bills} />

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
