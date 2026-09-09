<script lang="ts">
	import { toast } from 'svelte-sonner';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { ArrowLeftIcon, ArrowRight, TriangleAlert } from '@lucide/svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { resetPasswordSchema as schema } from './schema';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';

	let { data } = $props();

	const { form, errors, enhance, allErrors, message, delayed } = superForm(data.form, {
		validators: zod4Client(schema)
	});

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
	<title>Reset Password</title>
</svelte:head>

<div
	class="flex min-h-dvh w-full items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4"
>
	<Card class="shadow-lg-lg w-full max-w-md">
		<div class="flex w-full flex-col items-center justify-center">
			<img src="/logo.png" class="h-24 w-24" alt="Placeholder Logo" />
		</div>

		{#if !data.hasToken}
			<CardHeader class="flex flex-col gap-2 text-center">
				<div class="mb-4 flex justify-center">
					<div class="rounded-full bg-destructive/10 p-3">
						<TriangleAlert class="size-6 text-destructive" />
					</div>
				</div>
				<CardTitle class="text-2xl">This link is incomplete</CardTitle>
				<CardDescription>
					The reset link is missing its token — some mail apps break long links across lines.
					Request a new one and open it in a single click.
				</CardDescription>
			</CardHeader>

			<CardFooter class="mt-4 flex flex-col gap-3">
				<Button type="button" class="h-10 w-full rounded-lg" href="/forgot-password">
					Request a new link
				</Button>
				<Button type="button" variant="outline" class="h-10 w-full rounded-lg" href="/login">
					<ArrowLeftIcon class="mr-2 size-4" />
					Back to Login
				</Button>
			</CardFooter>
		{:else}
			<CardHeader class="flex flex-col gap-2">
				<CardTitle class="text-2xl">Choose a new password</CardTitle>
				<CardDescription>
					Pick something you are not using anywhere else. Signing in again afterwards is expected —
					every other session has been ended.
				</CardDescription>
			</CardHeader>

			<form use:enhance method="post" id="main">
				<CardContent class="flex flex-col gap-4">
					<Errors allErrors={$allErrors} />
					<input type="hidden" name="token" bind:value={$form.token} />

					<div class="flex flex-col gap-2">
						<Label for="newPassword" class="text-sm font-medium">New Password</Label>
						<Input
							id="newPassword"
							type="password"
							name="newPassword"
							autocomplete="new-password"
							bind:value={$form.newPassword}
							class="h-10 rounded-lg"
							required
						/>
						{#if $errors.newPassword}
							<p class="text-xs text-destructive">{$errors.newPassword}</p>
						{/if}
					</div>

					<div class="flex flex-col gap-2">
						<Label for="confirmPassword" class="text-sm font-medium">Confirm Password</Label>
						<Input
							id="confirmPassword"
							type="password"
							name="confirmPassword"
							autocomplete="new-password"
							bind:value={$form.confirmPassword}
							class="h-10 rounded-lg"
							required
						/>
						{#if $errors.confirmPassword}
							<p class="text-xs text-destructive">{$errors.confirmPassword}</p>
						{/if}
					</div>
				</CardContent>

				<CardFooter class="mt-4 flex flex-col gap-3">
					<Button type="submit" form="main" class="h-10 w-full rounded-lg">
						{#if $delayed}
							<LoadingBtn name="Updating Password" />
						{:else}
							<ArrowRight />
							Update Password
						{/if}
					</Button>
					<Button
						type="button"
						variant="outline"
						class="h-10 w-full rounded-lg"
						disabled={$delayed}
						href="/login"
					>
						<ArrowLeftIcon class="mr-2 size-4" />
						Back to Login
					</Button>
				</CardFooter>
			</form>
		{/if}
	</Card>
</div>
