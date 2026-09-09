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
	import { ArrowLeftIcon, LoaderIcon, CheckCircle, ArrowRight } from '@lucide/svelte';
	import { superForm } from 'sveltekit-superforms';
	import { ForgotPasswordSchema as schema } from './schema';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';

	let { data } = $props();

	let isSubmitted = $state(false);

	const { form, errors, enhance, allErrors, message, delayed } = superForm(data.form, {
		validators: zod4Client(schema)
	});

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				isSubmitted = true;
				toast.success($message.text);
			}
		}
	});
</script>

<svelte:head>
	<title>Forgot Password</title>
</svelte:head>

<div
	class="flex min-h-dvh w-full items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4"
>
	<Card class="shadow-lg-lg w-full max-w-md">
		{#if !isSubmitted}
			<div class="flex w-full flex-col items-center justify-center">
				<img src="/logo.png" class="h-24 w-24" alt="Placeholder Logo" />
			</div>
			<CardHeader class="flex flex-col gap-2">
				<CardTitle class="text-2xl">Forgot Password?</CardTitle>
				<CardDescription
					>Enter your email address and we'll send you a link to reset your password.</CardDescription
				>
			</CardHeader>

			<form use:enhance method="post" id="main" action="?/forgotPassword">
				<CardContent class="flex flex-col gap-4">
					<Errors allErrors={$allErrors} />
					<div class="flex flex-col gap-4">
						<Label for="email" class="text-sm font-medium">Email Address</Label>
						<Input
							id="email"
							type="email"
							name="email"
							placeholder="you@example.com"
							bind:value={$form.email}
							class="h-10 rounded-lg"
							required
						/>
						{#if $errors.email}
							<p class="text-xs text-destructive">{$errors.email}</p>
						{/if}
					</div>
				</CardContent>

				<CardFooter class="mt-4 flex flex-col gap-3">
					<Button type="submit" form="main" class="h-10 w-full rounded-lg">
						{#if $delayed}
							<LoadingBtn name="Sending Reset Password" />
						{:else}
							<ArrowRight />
							Send Reset Password
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
		{:else}
			<CardHeader class="flex flex-col gap-2 text-center">
				<div class="mb-4 flex justify-center">
					<div class="rounded-full bg-primary/10 p-3">
						<CheckCircle class="size-6 text-primary" />
					</div>
				</div>
				<CardTitle class="text-2xl">Check Your Email</CardTitle>
				<CardDescription>We've sent a password reset link to your email address.</CardDescription>
			</CardHeader>

			<CardContent class="flex flex-col gap-4 text-center">
				<p class="text-sm text-muted-foreground">
					Remember to check your spam folder if you don't see the email.
				</p>
			</CardContent>

			<CardFooter class="flex flex-col gap-3">
				<Button type="button" class="h-10 w-full rounded-lg" href="/login">Back to Login</Button>
				<Button
					type="button"
					variant="outline"
					class="h-10 w-full rounded-lg"
					onclick={() => (isSubmitted = false)}>Try Another Email</Button
				>
			</CardFooter>
		{/if}
	</Card>
</div>
