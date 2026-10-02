<script lang="ts">
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';

	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import type { Snapshot } from '@sveltejs/kit';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import Plus from '@lucide/svelte/icons/plus';
	import { changePasswordSchema } from './schema';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	let { data } = $props();
	import { updateFlash } from 'sveltekit-flash-message';
	import { page } from '$app/state';

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, capture, restore, allErrors } = createForm(
		data.form,
		changePasswordSchema,
		{
			onResult({ result }) {
				if (result.type === 'success') {
					goto(resolve('/login'));
				}
				updateFlash(page);
			},
			onError() {
				updateFlash(page);
			}
		}
	);

	export const snapshot: Snapshot = { capture, restore };
</script>

<svelte:head>
	<title>Change Password</title>
</svelte:head>

<Card.Root class="flex w-full flex-col gap-4 lg:w-lg">
	<Card.Header>
		<Card.Title class="text-2xl">Change Password</Card.Title>
	</Card.Header>
	<Card.Content>
		<form use:enhance action="?/changePassword" id="main" class="flex flex-col gap-4" method="POST">
			<Errors allErrors={$allErrors} />
			<InputComp
				{form}
				{errors}
				type="password"
				name="currentPassword"
				label="Current password"
				required
			/>
			<InputComp {form} {errors} type="password" name="newPassword" label="New password" required />
			<InputComp
				{form}
				{errors}
				type="password"
				name="confirmPassword"
				label="Confirm the new password"
				required
			/>

			{#if $form.newPassword !== $form.confirmPassword && $form.confirmPassword.length > 0}
				<span class="text-sm text-destructive">The passwords do not match</span>
			{/if}

			<Button
				type="submit"
				disabled={$form.newPassword !== $form.confirmPassword}
				class="mt-4"
				form="main"
			>
				{#if $delayed}
					<LoadingBtn name="Changing Password" />
				{:else}
					<Plus class="h-4 w-4" />

					Change Password
				{/if}
			</Button>
		</form>
	</Card.Content>
</Card.Root>
