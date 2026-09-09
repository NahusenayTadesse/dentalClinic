<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	// import { zod4Client } from "sveltekit-superforms/adapters";
	import type { AddCustomerSchema } from '$lib/ZodSchema';
	// import { createRoleSchema } from "$lib/ZodSchema";
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import SelectComp from '$lib/formComponents/SelectComp.svelte';
	import { gender } from '$lib/global.svelte';

	let {
		data,
		action = '/dashboard/cusotmers?/addCustomer'
	}: { data: SuperValidated<Infer<AddCustomerSchema>>; action: string } = $props();

	const { form, errors, enhance, delayed, message } = superForm(data, {
		taintedMessage: () => {
			return new Promise((resolve) => {
				resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
			});
		}
	});

	import { toast } from 'svelte-sonner';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
</script>

{#snippet fe(
	label = '',
	name = '',
	type = '',
	placeholder = '',
	required = false,
	min = '',
	max = ''
)}
	<div class="flex w-full flex-col justify-start gap-2">
		<Label for={name}>{label}</Label>
		<Input
			{type}
			{name}
			{placeholder}
			{required}
			{min}
			{max}
			bind:value={$form[name]}
			aria-invalid={$errors[name] ? 'true' : undefined}
		/>
		{#if $errors[name]}
			<span class="text-red-500">{$errors[name]}</span>
		{/if}
	</div>
{/snippet}
{#snippet selects(name, items)}
	<div class="flex w-full flex-col justify-start gap-2">
		<Label for={name} class="capitalize">{name.replace(/([a-z])([A-Z])/g, '$1 $2')}:</Label>

		<SelectComp {name} bind:value={$form[name]} {items} />
		{#if $errors[name]}<span class="text-red-500">{$errors[name]}</span>{/if}
	</div>
{/snippet}

<form {action} use:enhance method="post" id="edit" class="flex w-full flex-col gap-4 p-4">
	{@render fe('Customer First Name', 'firstName', 'text', 'Edit Customer First Name', true)}
	{@render fe('Customer Last Name', 'lastName', 'text', 'Edit Customer Last Name')}
	{@render fe('Customer Phone', 'phone', 'tel;', 'Edit Customer Phone', true)}
	{@render selects('gender', gender)}
	<Button type="submit" class="mt-4" form="edit">
		{#if $delayed}
			<LoadingBtn name="Adding Customer" />
		{:else}
			<Plus class="h-4 w-4" />

			Add Customer
		{/if}
	</Button>
</form>
