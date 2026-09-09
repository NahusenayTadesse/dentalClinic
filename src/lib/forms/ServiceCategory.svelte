<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	// import { zod4Client } from "sveltekit-superforms/adapters";
	import type { ServiceCategorySchema } from '$lib/ZodSchema';
	// import { createRoleSchema } from "$lib/ZodSchema";
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';

	let {
		data,
		action = '?/addCategory'
	}: { data: SuperValidated<Infer<ServiceCategorySchema>>; action: string } = $props();

	const { form, errors, enhance, delayed } = superForm(data, {
		taintedMessage: () => {
			return new Promise((resolve) => {
				resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
			});
		}

		// validators: zod4Client(createRoleSchema)
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

<form use:enhance {action} class="flex flex-col gap-4" method="POST">
	{@render fe('Category Name', 'name', 'text', 'Enter Category Name', true)}

	<div class="flex w-full flex-col justify-start gap-2">
		<Label for="description">Category Description</Label>

		<Textarea
			name="description"
			required
			placeholder="Enter role description"
			bind:value={$form.description}
			aria-invalid={$errors.description ? 'true' : undefined}
		/>

		{#if $errors.description}<span class="text-red-500">{$errors.description}</span>{/if}
	</div>

	<Button type="submit" class="mt-4">
		{#if $delayed}
			<LoadingBtn name="Adding Category" />
		{:else}
			<Plus class="h-4 w-4" />

			Add Category
		{/if}
	</Button>
</form>
