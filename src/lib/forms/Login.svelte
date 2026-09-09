<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	import type { SuperValidated, Infer } from 'sveltekit-superforms';
	import { superForm } from 'sveltekit-superforms';
	import type { LoginSchema } from '$lib/ZodSchema';
	import DarkMode from '$lib/components/DarkMode.svelte';
	import { Eye, EyeOff } from '@lucide/svelte';
	import Errors from '$lib/formComponents/Errors.svelte';

	let { data, action = '?/login' }: { data: SuperValidated<Infer<LoginSchema>>; action: string } =
		$props();

	const { form, errors, enhance, allErrors, message } = superForm(data, {});

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

	let eye = $state(false);
	let EyeIcon = $derived(eye ? EyeOff : Eye);
</script>

<Card.Root class="mx-auto flex w-full max-w-md flex-col justify-center justify-self-center ">
	<Card.Header>
		<div class="flex w-full flex-col items-center justify-center">
			<img src="/logo.webp" class="block h-24 w-24 dark:hidden" alt="Logo" />
			<img src="/logoWhite.webp" class="hidden h-24 w-24 dark:block" alt="Logo" />
		</div>
		<Card.Title class="flex flex-row justify-between text-2xl">Login <DarkMode /></Card.Title>
		<Card.Description>Enter your email below to login to your account</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" {action} use:enhance>
			<Errors allErrors={$allErrors} />

			<div class="grid gap-4">
				<div class="grid gap-2">
					<Label for="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						placeholder="m@example.com"
						bind:value={$form.email}
						required
					/>
					{#if $errors.email}<span class="text-red-500">{$errors.email}</span>{/if}
				</div>
				<div class="grid gap-2">
					<div class="flex items-center">
						<Label for="password">Password</Label>
						<a href="/forgot-password" class="ml-auto inline-block text-sm underline">
							Forgot your password?
						</a>
					</div>
					<div class="relative">
						<Input
							id="password"
							name="password"
							type={eye ? 'text' : 'password'}
							bind:value={$form.password}
							required
						/>
						<button type="button" onclick={() => (eye = !eye)} title="Make Password Visible">
							<EyeIcon
								class="absolute top-0.5 right-2 h-6 w-6 transition-transform duration-300 ease-in-out"
							/>
						</button>
						{#if $errors.password}<span class="text-red-500">{$errors.password}</span>{/if}
					</div>
				</div>
				<Button type="submit" class="w-full">Login</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>
