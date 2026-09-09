<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { addUserSchema } from '$lib/ZodSchema';
	import { superForm } from 'sveltekit-superforms/client';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';

	let { data } = $props();

	const { form, errors, enhance, delayed, capture, restore, message } = superForm(data.form, {
		taintedMessage: () => {
			return new Promise((resolve) => {
				resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
			});
		},
		onUpdated({ form }) {
			if (form.message) {
				if (form.message.type === 'success') {
					toast.success(form.message.text);
				} else {
					toast.error(form.message.text);
				}
			}
		},

		validators: zod4Client(addUserSchema)
	});

	import { toast } from 'svelte-sonner';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import PasswordGenerator from '$lib/components/password-generator.svelte';
	// $effect(() => {
	// 	if ($message) {
	// 		if ($message.type === 'error') {
	// 			toast.error($message.text);
	// 		} else {
	// 			toast.success($message.text);
	// 		}
	// 	}
	// });

	export const snapshot: Snapshot = { capture, restore };
</script>

<svelte:head>
	<title>Add New User</title>
</svelte:head>

<Card.Root class="flex w-full flex-col gap-4 lg:w-lg">
	<Card.Header>
		<Card.Title class="text-2xl">Add New User</Card.Title>
	</Card.Header>
	<Card.Content>
		<form use:enhance action="?/addUser" id="main" class="flex flex-col gap-4" method="POST">
			<!-- <InputComp {form} {errors} type="text" name="name" placeholder="" label="Employee Name" /> -->
			<InputComp
				{form}
				{errors}
				type="select"
				items={data?.officeWorkers}
				name="name"
				placeholder=""
				label="Employee Name"
			/>
			<InputComp {form} {errors} type="email" name="email" placeholder="" label="Email" />

			<InputComp {form} {errors} type="password" name="password" placeholder="" label="Password" />
			<div class="w-sm">
				<PasswordGenerator bind:password={$form.password} />
			</div>

			<InputComp
				{form}
				{errors}
				type="select"
				name="role"
				placeholder=""
				label="Role"
				items={data?.allRoles}
			/>

			<Button type="submit" class="mt-4" form="main">
				{#if $delayed}
					<LoadingBtn name="Adding Service" />
				{:else}
					<Plus class="h-4 w-4" />

					Add User
				{/if}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
