<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormDialog from '@nahu/admin-kit/formComponents/FormDialog.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import { formatETB } from '$lib/global.svelte';
	import { accountColumns, logColumns } from './columns';
	import TemplatesCard from './TemplatesCard.svelte';
	import { account, testSend, type Account, type TestSend } from './schema';

	/**
	 * The SMS screen: the gateway accounts the clinic sends through, what its messages say, and the
	 * log of what went out. The API key is typed in once and never shown again — only its last four
	 * characters — because it is stored encrypted and never sent back to a browser.
	 */
	let { data } = $props();

	type Field = ComponentProps<typeof InputComp>;

	const gatewayOptions = $derived(
		Object.entries(data.gatewayNames).map(([value, name]) => ({ value, name }))
	);

	let editOpen = $state(false);
	let editSeed = $state<Partial<Account>>({});
	let testOpen = $state(false);
	let testSeed = $state<Partial<TestSend>>({});
	let testing = $state('');

	const accounts = $derived(
		accountColumns(data.gatewayNames, data.canManageKeys, {
			edit: (row) => {
				editSeed = {
					id: row.id,
					provider: row.provider,
					label: row.label,
					apiKey: '',
					senderName: row.senderName ?? '',
					senderId: row.senderId ?? '',
					costPerSegment: row.costPerSegment,
					isDefault: row.isDefault
				};
				editOpen = true;
			},
			test: (row) => {
				testing = row.label;
				testSeed = { accountId: row.id, phone: '' };
				testOpen = true;
			}
		})
	);
	const log = $derived(logColumns(data.gatewayNames));

	const inUse = $derived(data.accounts.find((a) => a.isDefault) ?? null);
	const sent = $derived(data.log.filter((m) => m.status === 'sent'));
	const spent = $derived(sent.reduce((sum, m) => sum + (m.cost ?? 0), 0));
	const unpriced = $derived(sent.some((m) => m.cost === null));
</script>

<svelte:head>
	<title>SMS</title>
</svelte:head>

{#snippet accountFields(form: Field['form'], errors: Field['errors'], editing: boolean)}
	<InputComp {form} {errors} name="provider" label="Gateway" type="select" items={gatewayOptions} />
	<InputComp {form} {errors} name="label" label="Name" placeholder="AfroMessage — main line" />
	<InputComp
		{form}
		{errors}
		name="apiKey"
		label="API key"
		type="password"
		required={!editing}
		placeholder={editing ? 'Leave empty to keep the key you saved' : 'From the gateway’s dashboard'}
	/>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<InputComp
			{form}
			{errors}
			name="senderName"
			label="Sender name"
			required={false}
			placeholder="As the gateway approved it"
		/>
		<InputComp
			{form}
			{errors}
			name="senderId"
			label="Identifier / shortcode id"
			required={false}
			placeholder="Optional"
		/>
	</div>
	<InputComp
		{form}
		{errors}
		name="costPerSegment"
		label="Cost per segment (birr)"
		type="number"
		step={0.01}
		min={0}
		required={false}
		placeholder="What the gateway charges you"
	/>
	<InputComp
		{form}
		{errors}
		name="isDefault"
		type="checkboxSingle"
		label="In use"
		placeholder="Send reminders and recalls through this account"
	/>
{/snippet}

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">SMS</h1>
		<p class="text-muted-foreground">
			Text reminders and recalls to patients through an Ethiopian SMS gateway.
			{#if inUse}
				Sending through <strong>{inUse.label}</strong>.
			{:else}
				No gateway is set up yet, so nothing is sent.
			{/if}
		</p>
	</header>

	<Section title="Gateway accounts" IconComp={KeyRound} style="identityIcon">
		{#snippet editDialog()}
			{#if data.canManageKeys}
				<div class="ml-auto">
					<FormDialog
						title="Add a gateway account"
						description="The key is stored encrypted and never shown again, only its last four characters."
						action="?/saveAccount"
						data={data.forms.account}
						schema={account}
						triggerLabel="Add account"
						resetOnSuccess
					>
						{#snippet fields({ form, errors })}
							{@render accountFields(form, errors, false)}
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
					? 'Add the account your gateway gave you: its API key, and the sender name it approved.'
					: 'A super administrator adds the gateway account and its key.'}
			</p>
		{/if}
		<p class="mt-2 text-xs text-muted-foreground">
			AfroMessage and GeezSMS are supported. Messages go only to Ethiopian mobile numbers, and never
			to a patient who asked not to be texted.
		</p>
	</Section>

	<Section title="What the messages say" IconComp={MessageSquare} style="identityIcon">
		<TemplatesCard data={data.forms.templates} costPerSegment={inUse?.costPerSegment ?? null} />
	</Section>

	<Section title="Sent in the last {data.logDays} days" IconComp={ScrollText} style="identityIcon">
		<p class="mb-3 text-sm">
			{sent.length}
			{sent.length === 1 ? 'message' : 'messages'} sent at this branch ·
			{formatETB(spent)}{unpriced ? ' (some without a known cost)' : ''}
		</p>
		{#if data.log.length}
			<DataTable
				columns={log}
				data={data.log}
				facetKeys={['kind', 'status', 'provider']}
				search
				fileName="sms-log"
				height="auto"
			/>
		{:else}
			<p class="text-sm text-muted-foreground">Nothing has been sent yet.</p>
		{/if}
	</Section>
</div>

<FormDialog
	title="Change this gateway account"
	description="Leave the key empty to keep the one saved."
	action="?/saveAccount"
	data={data.forms.accountEdit}
	schema={account}
	bind:open={editOpen}
	seed={editSeed}
	hideTrigger
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="id" value={values.id} />
		{@render accountFields(form, errors, true)}
	{/snippet}
</FormDialog>

<FormDialog
	title="Send a test through {testing}"
	description="A short English message to a phone you can check. It is logged as a test."
	action="?/sendTest"
	data={data.forms.test}
	schema={testSend}
	bind:open={testOpen}
	seed={testSeed}
	hideTrigger
	submitLabel="Send test"
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="accountId" value={values.accountId} />
		<InputComp {form} {errors} name="phone" label="Mobile number" placeholder="0911 …" />
	{/snippet}
</FormDialog>
