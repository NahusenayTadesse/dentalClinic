<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
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
	import { ArrowRight, ShieldCheck } from '@lucide/svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { setupSchema as schema } from './schema';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';

	let { data } = $props();

	const { form, errors, enhance, allErrors, message, delayed } = superForm(data.form, {
		validators: zod4Client(schema)
	});

	$effect(() => {
		if ($message?.type === 'error') toast.error($message.text);
	});
</script>

<svelte:head>
	<title>Set up your clinic</title>
</svelte:head>

<div class="flex min-h-dvh w-full items-center justify-center bg-background p-4">
	<Card class="shadow-lg-lg w-full max-w-md">
		<div class="flex w-full flex-col items-center justify-center">
			<Logo class="h-20" />
		</div>

		<CardHeader class="flex flex-col gap-2">
			<CardTitle class="flex items-center gap-2 text-2xl">
				<ShieldCheck class="size-6 text-primary" /> First-time setup
			</CardTitle>
			<CardDescription>
				This creates the first administrator, who holds every permission. It runs once — after this,
				accounts are created from the admin panel.
			</CardDescription>
		</CardHeader>

		<form use:enhance method="post" id="main">
			<CardContent class="flex flex-col gap-4">
				<Errors allErrors={$allErrors} />

				<div class="flex flex-col gap-2">
					<Label for="name" class="text-sm font-medium">Your Name</Label>
					<Input id="name" name="name" bind:value={$form.name} class="h-10 rounded-lg" required />
					{#if $errors.name}<p class="text-xs text-destructive">{$errors.name}</p>{/if}
				</div>

				<div class="flex flex-col gap-2">
					<Label for="email" class="text-sm font-medium">Email Address</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autocomplete="username"
						placeholder="you@example.com"
						bind:value={$form.email}
						class="h-10 rounded-lg"
						required
					/>
					{#if $errors.email}<p class="text-xs text-destructive">{$errors.email}</p>{/if}
				</div>

				<div class="flex flex-col gap-2">
					<Label for="password" class="text-sm font-medium">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autocomplete="new-password"
						bind:value={$form.password}
						class="h-10 rounded-lg"
						required
					/>
					{#if $errors.password}<p class="text-xs text-destructive">{$errors.password}</p>{/if}
				</div>

				<div class="flex flex-col gap-2">
					<Label for="confirmPassword" class="text-sm font-medium">Confirm Password</Label>
					<Input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
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

			<CardFooter class="mt-4">
				<Button type="submit" form="main" class="h-10 w-full rounded-lg">
					{#if $delayed}
						<LoadingBtn name="Setting up" />
					{:else}
						<ArrowRight /> Create administrator
					{/if}
				</Button>
			</CardFooter>
		</form>
	</Card>
</div>
