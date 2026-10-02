<script lang="ts">
	import { Input } from '@nahu/admin-kit/components/ui/input/index.js';
	import { Label } from '@nahu/admin-kit/components/ui/label/index.js';

	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import type { Snapshot } from '@sveltejs/kit';
	import * as Card from '@nahu/admin-kit/components/ui/card/index.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { goto } from '$app/navigation';

	import { Eye, Plus, EyeClosed } from '@lucide/svelte';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { changePasswordSchema } from './schema';
	import { superForm } from 'sveltekit-superforms/client';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	let { data } = $props();
	import { updateFlash } from 'sveltekit-flash-message';
	import { page } from '$app/state';

	const { form, errors, enhance, delayed, capture, restore, allErrors, message } = superForm(
		data.form,
		{
			onResult({ result }) {
				if (result.type === 'success') {
					goto('/login');
				}
				updateFlash(page);
			},
			onError() {
				updateFlash(page);
			},

			validators: zod4Client(changePasswordSchema)
		}
	);

	export const snapshot: Snapshot = { capture, restore };
	let eye = $state(false);
	let EyeIcon = $derived(eye ? Eye : EyeClosed);
</script>

<svelte:head>
	<title>Change Password</title>
</svelte:head>
{#snippet fe(label = '', name = '', placeholder = '', required = false, min = '', max = '')}
	<div class="relative flex w-full flex-col justify-start gap-2">
		<Label for={name}>{label}</Label>
		<Input
			type={eye ? 'text' : 'password'}
			{name}
			{placeholder}
			{required}
			{min}
			{max}
			bind:value={$form[name]}
			aria-invalid={$errors[name] ? 'true' : undefined}
		/>
		<button type="button" onclick={() => (eye = !eye)} title="Make Password Visible">
			<EyeIcon
				class="absolute top-7 right-2 h-6 w-6 transition-transform duration-300 ease-in-out"
			/>
		</button>
		{#if $errors[name]}
			{#each $errors[name] as error}
				<span class="text-red-500">{error}</span>
			{/each}
		{/if}
	</div>
{/snippet}

<Card.Root class="flex w-full flex-col gap-4 lg:w-lg">
	<Card.Header>
		<Card.Title class="text-2xl">Change Password</Card.Title>
	</Card.Header>
	<Card.Content>
		<form use:enhance action="?/changePassword" id="main" class="flex flex-col gap-4" method="POST">
			<Errors allErrors={$allErrors} />
			{@render fe('Current Password', 'currentPassword', 'Enter your current password', true)}
			{@render fe('New Password', 'newPassword', 'Enter your new password', true)}
			{@render fe(
				'Confirm New Password',
				'confirmPassword',

				'Confirm New password',
				true
			)}

			{#if $form.newPassword !== $form.confirmPassword && $form.confirmPassword.length > 0}
				<span class="text-red-500">Passwords do not match</span>
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
