<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Snapshot } from '@sveltejs/kit';

	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import DatePicker2 from '$lib/formComponents/DatePicker2.svelte';

	import * as Card from '$lib/components/ui/card/index.js';
	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { bonusSchema as schema } from './schema';
	import { superForm } from 'sveltekit-superforms/client';
	import Errors from '$lib/formComponents/Errors.svelte';
	let { data } = $props();

	import { updateFlash } from 'sveltekit-flash-message';
	import { page } from '$app/state';

	const { form, errors, enhance, delayed, allErrors, capture, restore, message } = superForm(
		data.form,
		{
			taintedMessage: () => {
				return new Promise((resolve) => {
					resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
				});
			},
			validators: zod4Client(schema),

			onResult() {
				updateFlash(page);
			},

			onError() {
				updateFlash(page);
			}
		}
	);

	export const snapshot: Snapshot = { capture, restore };
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

<svelte:head>
	<title>Add New Bonus</title>
</svelte:head>

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

{#snippet date(name, title)}
	<Label for={name} class="capitalize">{title}</Label>

	<DatePicker2 bind:data={$form[name]} oldDays={true} />
	<input type="hidden" {name} bind:value={$form[name]} />
	{#if $errors[name]}<span class="text-red-500">{$errors[name]}</span>{/if}
{/snippet}

<Card.Root class="flex w-full flex-col gap-4 lg:w-lg">
	<Card.Header>
		<Card.Title class="text-2xl">Add a Bonus on {data.salaryDetail.name}</Card.Title>
	</Card.Header>
	<Card.Content>
		<form use:enhance action="?/addBonus" id="main" class="flex flex-col gap-4" method="post">
			<Errors allErrors={$allErrors} />

			{@render date('bonusDate', 'Bonus Date')}

			{@render fe(
				'Bonus Amount',
				'amount',
				'number',
				'Enter the total amount of the bonus',
				true,
				'0'
			)}

			<div class="flex w-full flex-col justify-start gap-2">
				<Label for="description">Bonus Description (optional)</Label>

				<Textarea
					name="description"
					placeholder="Enter bonus description"
					bind:value={$form.description}
					aria-invalid={$errors.description ? 'true' : undefined}
				/>

				{#if $errors.description}<span class="text-red-500">{$errors.description}</span>{/if}
			</div>

			<Button type="submit" class="mt-4" form="main">
				{#if $delayed}
					<LoadingBtn name="Adding Bonus" />
				{:else}
					<Plus class="h-4 w-4" />
					Add Bonus
				{/if}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
