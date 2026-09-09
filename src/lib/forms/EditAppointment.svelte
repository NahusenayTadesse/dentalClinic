<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	import { Save } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { ExistingCustomerAppointmentForm } from '$lib/ZodSchema';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import RadioComp from '$lib/formComponents/RadioComp.svelte';
	import ComboboxComp from '$lib/formComponents/ComboboxComp.svelte';
	import SelectComp from '$lib/formComponents/SelectComp.svelte';

	type Customer = { value: number; name: string }; // whatever shape you use
	let {
		data,
		customers,
		action = '?/editForm'
	}: {
		data: SuperValidated<Infer<ExistingCustomerAppointmentForm>>;
		customers: Customer[];
		action: string;
	} = $props();

	const { form, errors, enhance, delayed } = superForm(data);
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
{#snippet radio(name, items)}
	<div class="flex w-full flex-col justify-start gap-2">
		<Label for={name} class="capitalize">{name.replace(/([a-z])([A-Z])/g, '$1 $2')}:</Label>

		<RadioComp
			{name}
			bind:value={$form[name]}
			btnName={name.replace(/([a-z])([A-Z])/g, '$1 $2')}
			{items}
		/>
		{#if $errors[name]}<span class="text-red-500">{$errors[name]}</span>{/if}
	</div>
{/snippet}
{#snippet combo(name, items)}
	<div class="flex w-full flex-col justify-start gap-2">
		<Label for={name} class="capitalize">{name.replace(/([a-z])([A-Z])/g, '$1 $2')}:</Label>

		<ComboboxComp {name} bind:value={$form[name]} {items} />
		{#if $errors[name]}<span class="text-red-500">{$errors[name]}</span>{/if}
	</div>
{/snippet}

<form use:enhance {action} class="flex flex-col gap-4" method="POST">
	{@render combo('customerId', customers)}
	{@render fe('Time', 'appointmentTime', 'time', '', true)}
	{@render fe('Date', 'appointmentDate', 'date', '', true)}
	{@render fe('Notes', 'notes', 'text', '')}

	<Button type="submit" class="mt-4">
		{#if $delayed}
			<LoadingBtn name="Saving Appointment Edits" />
		{:else}
			<Save class="h-4 w-4" />

			Save Changes
		{/if}
	</Button>
</form>
