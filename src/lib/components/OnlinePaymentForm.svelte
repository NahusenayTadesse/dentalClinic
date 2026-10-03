<script lang="ts">
	import Link from '@lucide/svelte/icons/link';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { formatETB } from '$lib/global.svelte';
	import { onlinePayment, type OnlinePayment } from '$lib/forms/payment';
	import { GATEWAY_INFO, type GatewayMode, type PaymentGateway } from '$lib/paymentGateways';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import BillAllocations from './BillAllocations.svelte';

	/**
	 * Asking for a payment online: an amount against each bill, the gateway account to take it
	 * through, and the patient's phone. Posts to `?/payOnline`, which asks the gateway for a checkout;
	 * the link then waits on the list beside it (`OnlinePayments`) until the gateway says it was paid.
	 */
	let {
		data,
		bills,
		gateways,
		phone,
		oncreated
	}: {
		data: SuperValidated<OnlinePayment>;
		bills: { id: number; number: string | null; owed: number; issuedOn: string }[];
		gateways: { id: number; label: string; provider: PaymentGateway; mode: GatewayMode }[];
		/** The patient's phone, to start the field with. */
		phone: string | null;
		/** Called once the link exists — the dialog closes itself with it. */
		oncreated?: () => void;
	} = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.online);

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data, onlinePayment, {
		dataType: 'json',
		onUpdated({ form }) {
			if (form.message?.type === 'success') oncreated?.();
		}
	});

	// One gateway is the choice already made; the phone starts as the patient's.
	$effect(() => {
		const only = gateways.length === 1 ? String(gateways[0].id) : '';
		form.update(
			(f) => ({ ...f, gatewayId: f.gatewayId || only, phone: f.phone || (phone ?? '') }),
			{ taint: false }
		);
	});

	const total = $derived($form.allocations.reduce((sum, a) => sum + (a.amount || 0), 0));
	const gatewayItems = $derived(
		gateways.map((g) => ({
			value: String(g.id),
			name: `${g.label} — ${GATEWAY_INFO[g.provider].takes}${g.mode === 'test' ? ` (${w.test})` : ''}`
		}))
	);
</script>

<form method="post" action="?/payOnline" use:enhance class="flex flex-col gap-4">
	<Errors allErrors={$allErrors} />

	<BillAllocations {form} {bills} />

	<InputComp
		label={w.through}
		name="gatewayId"
		type="select"
		{form}
		{errors}
		items={gatewayItems}
	/>
	<InputComp
		label={w.phone}
		name="phone"
		required={false}
		placeholder={w.phonePlaceholder}
		{form}
		{errors}
	/>

	<div class="flex items-center justify-between gap-3">
		<p class="text-sm">
			{t.m.billing.pay.total} <span class="font-semibold tabular-nums">{formatETB(total)}</span>
		</p>
		<Button type="submit" disabled={$delayed || total <= 0}>
			{#if $delayed}
				<LoadingBtn name={w.creating} />
			{:else}
				<Link class="size-4" /> {w.create}
			{/if}
		</Button>
	</div>
</form>
