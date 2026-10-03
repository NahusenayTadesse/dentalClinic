<script lang="ts">
	import Globe from '@lucide/svelte/icons/globe';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import CircleStop from '@lucide/svelte/icons/circle-stop';
	import { toast } from 'svelte-sonner';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import Statuses from '@nahu/admin-kit/components/Table/statuses.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import { clinicClock, clinicDate } from '$lib/clinicTime';
	import type { OnlinePayment } from '$lib/forms/payment';
	import { GATEWAY_INFO, type GatewayMode, type PaymentGateway } from '$lib/paymentGateways';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import OnlinePaymentForm from './OnlinePaymentForm.svelte';

	/**
	 * A patient's online payments, and starting one: on the billing tab (every payable bill) and on
	 * a bill's own page (that one). A payment waiting shows its link — to open on this screen, copy,
	 * or text to the patient — and is checked with the gateway every few seconds while it is fresh,
	 * so the desk sees "Paid" without pressing anything. The check is the server asking the gateway;
	 * nothing here decides that money arrived.
	 */
	let {
		payments,
		gateways,
		bills,
		phone,
		smsReady,
		forms
	}: {
		payments: {
			id: number;
			provider: PaymentGateway;
			account: string;
			mode: GatewayMode;
			amount: number;
			status: 'pending' | 'paid' | 'failed' | 'cancelled';
			checkoutUrl: string | null;
			error: string | null;
			createdAt: Date;
			receiptNumber: string | null;
		}[];
		gateways: { id: number; label: string; provider: PaymentGateway; mode: GatewayMode }[];
		bills: { id: number; number: string | null; owed: number; issuedOn: string }[];
		phone: string | null;
		smsReady: boolean;
		forms: { start: SuperValidated<OnlinePayment>; step: SuperValidated<Record<string, unknown>> };
	} = $props();

	const t = useI18n();
	const w = $derived(t.m.billing.online);

	let open = $state(false);

	/** Fresh enough to keep asking about without anyone pressing Check. */
	const WATCH_MS = 20 * 60 * 1000;
	const watched = $derived(
		payments.filter(
			(p) => p.status === 'pending' && Date.now() - new Date(p.createdAt).getTime() < WATCH_MS
		)
	);

	// While a fresh payment waits, ask about it every few seconds and redraw with the answer.
	$effect(() => {
		const ids = watched.map((p) => p.id);
		if (!ids.length) return;
		const timer = setInterval(async () => {
			for (const id of ids) {
				const body = new FormData();
				body.set('id', String(id));
				await fetch('?/checkOnline', {
					method: 'POST',
					body,
					headers: { 'x-sveltekit-action': 'true' }
				}).catch(() => null);
			}
			await invalidateAll();
		}, 6000);
		return () => clearInterval(timer);
	});

	async function copy(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			toast.success(w.copied);
		} catch {
			toast.error(url);
		}
	}
</script>

{#if gateways.length || payments.length}
	<Section title={w.title} IconComp={Globe} style="identityIcon">
		{#snippet editDialog()}
			{#if gateways.length}
				<Button
					class="ml-auto"
					size="sm"
					variant="outline"
					disabled={!bills.length}
					onclick={() => (open = true)}
				>
					<Globe class="size-4" />
					{w.payOnline}
				</Button>
			{/if}
		{/snippet}

		{#if payments.length}
			<ul class="flex flex-col divide-y rounded-md border">
				{#each payments as p (p.id)}
					<li class="flex flex-col gap-2 px-3 py-2 text-sm">
						<div class="flex flex-wrap items-center gap-2">
							<span class="font-semibold tabular-nums">{formatETB(p.amount)}</span>
							<span class="text-muted-foreground">
								· {GATEWAY_INFO[p.provider].name} ({p.account}{p.mode === 'test'
									? `, ${w.test}`
									: ''}) · {formatEthiopianDate(new Date(clinicDate(p.createdAt)))}
								{clinicClock(p.createdAt)}
							</span>
							<span class="ml-auto">
								<!-- The colour from the status; the words in the viewer's language. -->
								<Statuses
									status={p.status === 'failed' ? 'rejected' : p.status}
									label={w.status[p.status]}
								/>
							</span>
						</div>
						{#if p.status === 'paid' && p.receiptNumber}
							<p class="text-muted-foreground">{w.receipt(p.receiptNumber)}</p>
						{:else if p.status === 'failed' && p.error}
							<p class="text-destructive">{p.error}</p>
						{/if}
						{#if p.status === 'pending'}
							<div class="flex flex-wrap gap-2">
								{#if p.checkoutUrl}
									<Button size="sm" variant="outline" href={p.checkoutUrl} target="_blank">
										<ExternalLink class="size-4" />
										{w.open}
									</Button>
									<Button size="sm" variant="outline" onclick={() => copy(p.checkoutUrl ?? '')}>
										<Copy class="size-4" />
										{w.copy}
									</Button>
									{#if smsReady}
										<StepButton
											id="online-text-{p.id}"
											action="?/textOnline"
											data={forms.step}
											values={{ id: p.id }}
											label={w.text}
											icon={MessageSquare}
										/>
									{/if}
								{/if}
								<StepButton
									id="online-check-{p.id}"
									action="?/checkOnline"
									data={forms.step}
									values={{ id: p.id }}
									label={w.check}
									icon={RefreshCw}
								/>
								<StepButton
									id="online-stop-{p.id}"
									action="?/stopOnline"
									data={forms.step}
									values={{ id: p.id }}
									label={w.stop}
									icon={CircleStop}
									variant="ghost"
								/>
							</div>
							{#if watched.some((x) => x.id === p.id)}
								<p class="text-xs text-muted-foreground">{w.watching}</p>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">{w.none}</p>
		{/if}
	</Section>
{/if}

<DialogComp title={w.dialogTitle} variant="ghost" bind:open>
	{#snippet trigger()}{/snippet}
	<div class="flex flex-col gap-3 p-4">
		<p class="text-sm text-muted-foreground">{w.dialogDescription}</p>
		<OnlinePaymentForm
			data={forms.start}
			{bills}
			{gateways}
			{phone}
			oncreated={() => (open = false)}
		/>
	</div>
</DialogComp>
