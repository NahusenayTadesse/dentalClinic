<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Webhook from '@lucide/svelte/icons/webhook';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatETB } from '$lib/global.svelte';
	import { GATEWAY_INFO, PAYMENT_GATEWAYS, type PaymentGateway } from '$lib/paymentGateways';
	import { accountColumns, logColumns } from './columns';
	import { gateway, type Gateway } from './schema';

	/**
	 * The payment gateways screen: the clinic's accounts at each gateway, where each posts its
	 * notifications, and the online payments of the last month. A key is typed in once and never
	 * shown again — only its last four characters — because it is stored encrypted and never sent
	 * back to a browser.
	 */
	let { data } = $props();

	type Field = ComponentProps<typeof InputComp>;

	const gatewayOptions = PAYMENT_GATEWAYS.map((value) => ({
		value,
		name: `${GATEWAY_INFO[value].name} — ${GATEWAY_INFO[value].takes}`
	}));
	const modeOptions = [
		{ value: 'test', name: 'Test — the gateway’s sandbox, no real money' },
		{ value: 'live', name: 'Live — takes real money' }
	];

	let editOpen = $state(false);
	let editSeed = $state<Partial<Gateway>>({});

	const accounts = $derived(
		accountColumns(data.canManageKeys, (row) => {
			editSeed = {
				id: row.id,
				provider: row.provider,
				label: row.label,
				mode: row.mode,
				enabled: row.enabled,
				...row.settings
			};
			editOpen = true;
		})
	);
	const log = logColumns();

	const switchedOn = $derived(data.accounts.filter((a) => a.enabled));
	const paid = $derived(data.log.filter((p) => p.status === 'paid'));
	const taken = $derived(paid.reduce((sum, p) => sum + p.amount, 0));
	const usedGateways = $derived([...new Set(data.accounts.map((a) => a.provider))]);
</script>

<svelte:head>
	<title>Payment Gateways</title>
</svelte:head>

{#snippet accountFields(
	form: Field['form'],
	errors: Field['errors'],
	provider: PaymentGateway | undefined,
	editing: boolean
)}
	<InputComp {form} {errors} name="provider" label="Gateway" type="select" items={gatewayOptions} />
	<InputComp {form} {errors} name="label" label="Name" placeholder="Chapa — main account" />
	<InputComp {form} {errors} name="mode" label="Mode" type="select" items={modeOptions} />
	{#if provider}
		{#each GATEWAY_INFO[provider].fields as field (field.key)}
			<InputComp
				{form}
				{errors}
				name={field.key}
				label={field.label}
				type={field.multiline ? 'textarea' : field.secret ? 'password' : 'text'}
				required={!(editing && field.secret)}
				placeholder={editing && field.secret
					? 'Leave empty to keep the one you saved'
					: (field.placeholder ?? `From your ${GATEWAY_INFO[provider].name} dashboard`)}
			/>
		{/each}
	{/if}
	<InputComp
		{form}
		{errors}
		name="enabled"
		type="checkboxSingle"
		label="At the desk"
		placeholder="Offer this account when taking a payment online"
	/>
{/snippet}

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">Payment Gateways</h1>
		<p class="text-muted-foreground">
			Take bills online through Chapa, Telebirr, ArifPay or SantimPay: the patient pays from a link
			on their phone, and the payment is recorded once the gateway confirms it.
			{#if switchedOn.length}
				{switchedOn.length === 1 ? 'One account is' : `${switchedOn.length} accounts are`} offered at
				the desk.
			{:else}
				No account is switched on yet, so the desk cannot take payments online.
			{/if}
		</p>
	</header>

	<Section title="Gateway accounts" IconComp={KeyRound} style="identityIcon">
		{#snippet editDialog()}
			{#if data.canManageKeys}
				<div class="ml-auto">
					<FormDialog
						title="Add a gateway account"
						description="Keys are stored encrypted and never shown again, only the last four characters."
						action="?/save"
						data={data.forms.add}
						schema={gateway}
						triggerLabel="Add account"
						resetOnSuccess
					>
						{#snippet fields({ form, errors, values })}
							{@render accountFields(form, errors, values.provider, false)}
						{/snippet}
					</FormDialog>
				</div>
			{/if}
		{/snippet}
		{#if data.accounts.length}
			<DataTable columns={accounts} data={data.accounts} height="auto" />
		{:else}
			<p class="text-sm text-muted-foreground">
				{data.canManageKeys
					? 'Add the account your gateway gave you. Start in test mode with its test keys, take a payment on a test patient, then switch to live.'
					: 'A super administrator adds the gateway accounts and their keys.'}
			</p>
		{/if}
	</Section>

	{#if usedGateways.length}
		<Section title="Notifications" IconComp={Webhook} style="identityIcon">
			<p class="mb-3 text-sm text-muted-foreground">
				Give each gateway this address as its webhook or notify URL, so a payment shows as paid the
				moment it is made. A notification only makes this system ask the gateway — it is never taken
				on its word. Without one (an install the internet cannot reach), the desk's Check button and
				the scheduled check find the payment instead.
			</p>
			<ul class="flex flex-col gap-1 text-sm">
				{#each usedGateways as provider (provider)}
					<li>
						<span class="font-medium">{GATEWAY_INFO[provider].name}:</span>
						<code class="rounded bg-muted px-1.5 py-0.5 text-xs">{data.notifyBase}/{provider}</code>
					</li>
				{/each}
			</ul>
		</Section>
	{/if}

	<Section
		title="Online payments, last {data.logDays} days"
		IconComp={ScrollText}
		style="identityIcon"
	>
		<p class="mb-3 text-sm">
			{paid.length}
			{paid.length === 1 ? 'payment' : 'payments'} received at this branch · {formatETB(taken)}
		</p>
		{#if data.log.length}
			<DataTable
				columns={log}
				data={data.log}
				facetKeys={['provider', 'status']}
				search
				fileName="online-payments"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">No payment has been taken online yet.</p>
		{/if}
	</Section>
</div>

<FormDialog
	title="Change this gateway account"
	description="Leave a key empty to keep the one saved."
	action="?/save"
	data={data.forms.edit}
	schema={gateway}
	bind:open={editOpen}
	seed={editSeed}
	hideTrigger
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="id" value={values.id} />
		{@render accountFields(form, errors, values.provider, true)}
	{/snippet}
</FormDialog>
