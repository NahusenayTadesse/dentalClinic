<script lang="ts">
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { SquarePen, Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	// `Infer<>` needs the zod schema itself; this used to import the already
	// inferred type and wrap it again, which left every `$form.x` untyped.
	import type { editPaymentMethod } from './schema';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import Errors from '$lib/formComponents/Errors.svelte';

	let {
		data,
		action = '/dashboard/customers?/addCustomer',
		id,
		bank,
		banks,
		amount,
		account,
		icon = false
	}: {
		data: SuperValidated<Infer<typeof editPaymentMethod>>;
		action: string;
		id: number;
		bank: number | string;
		banks: Item[];
		account: string;
		amount: number | string;
		icon: boolean;
	} = $props();

	const { form, errors, enhance, delayed, message, allErrors } = superForm(data, {
		resetForm: false
	});

	let open = $state(false);
	let acknowledgeManualChange = $state(false);

	/** True once the figure differs from what is on file, so the warning can be specific. */
	let changed = $derived(Number($form.amount ?? 0) !== Number(amount));

	const money = (value: number) =>
		value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	$form.id = id;
	$form.bank = bank;
	$form.amount = Number(amount);
	$form.account = account;

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import Messages from '$lib/formComponents/Messages.svelte';
	import RiskAcknowledgement from '$lib/formComponents/RiskAcknowledgement.svelte';
	import type { Item } from '$lib/global.svelte';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
				open = false;
			}
		}
	});
</script>

<DialogComp title="Edit Bank" variant="ghost" bind:open triggerClass="justify-self-start p-0!">
	{#snippet trigger(props)}
		<Button
			size="sm"
			variant="ghost"
			class="flex w-auto flex-row items-center justify-center gap-2 justify-self-start border-0 p-0!"
			{...props}
		>
			{#if icon}
				<SquarePen /> Edit
			{:else}
				{banks?.find((f: Item) => String(f.value) === String(bank))?.name}
			{/if}
		</Button>
	{/snippet}
	<form {action} use:enhance method="post" id="edit" class="flex w-full flex-col gap-4 p-4">
		<Errors allErrors={$allErrors} />
		<input type="hidden" name="id" value={$form.id} />
		<InputComp
			{form}
			{errors}
			label="Bank"
			type="combo"
			name="bank"
			required={true}
			items={banks}
		/>
		<InputComp {form} {errors} label="Account Number" type="text" name="account" required={true} />

		<InputComp {form} {errors} label="Amount" type="number" name="amount" required={true} />

		<RiskAcknowledgement
			show={true}
			name="acknowledgeManualChange"
			bind:checked={acknowledgeManualChange}
			title="This overwrites the balance directly"
			message={changed
				? `Setting this to ${money(Number($form.amount ?? 0))} replaces the recorded ${money(Number(amount))} outright — it is not a payment or an expense, so nothing appears in the bank history to explain the difference.${Number($form.amount ?? 0) < 0 ? ' You are also putting the account below zero, which is allowed but rarely intended.' : ''}`
				: 'Saving writes the amount straight over the running balance, without a matching entry in the bank history.'}
		/>

		<Button type="submit" class="mt-4" form="edit">
			{#if $delayed}
				<LoadingBtn name="Adding Menu Item" />
			{:else}
				<Save class="h-4 w-4" />

				Save Changes
			{/if}
		</Button>
	</form>
</DialogComp>
