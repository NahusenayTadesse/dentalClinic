<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox as Switch } from '$lib/components/ui/checkbox/index.js';
	import { Slider } from '$lib/components/ui/slider';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import {
		RefreshCwIcon,
		CopyIcon,
		CheckIcon,
		EyeIcon,
		EyeOffIcon,
		ShieldCheckIcon
	} from '@lucide/svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import { onMount } from 'svelte';

	let { password = $bindable() } = $props();
	// State
	let passwordLength: number = $state(16);
	let includeUppercase: boolean = $state(true);
	let includeLowercase: boolean = $state(true);
	let includeNumbers: boolean = $state(true);
	let includeSymbols: boolean = $state(true);
	let showPassword: boolean = $state(false);
	let copied: boolean = $state(false);
	let isGenerating: boolean = $state(false);

	let includes = $derived(includeUppercase || includeLowercase || includeNumbers || includeSymbols);

	// Password strength calculation
	const passwordStrength = $derived.by(() => {
		if (!password) return { label: 'None', color: 'bg-muted', width: 'w-0' };
		let score = 0;
		if (password.length >= 8) score++;
		if (password.length >= 12) score++;
		if (password.length >= 16) score++;
		if (/[A-Z]/.test(password)) score++;
		if (/[a-z]/.test(password)) score++;
		if (/[0-9]/.test(password)) score++;
		if (/[^A-Za-z0-9]/.test(password)) score++;

		if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/4' };
		if (score <= 4) return { label: 'Fair', color: 'bg-orange-500', width: 'w-2/4' };
		if (score <= 5) return { label: 'Good', color: 'bg-yellow-500', width: 'w-3/4' };
		return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
	});

	/** Generate a random password */
	const generatePassword = () => {
		isGenerating = true;

		let charset = '';
		if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
		if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		if (includeNumbers) charset += '0123456789';
		if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

		if (!charset) {
			toast.error('Please select at least one character type');
			isGenerating = false;
			return;
		}

		let result = '';
		const length = passwordLength;
		for (let i = 0; i < length; i++) {
			result += charset.charAt(Math.floor(Math.random() * charset.length));
		}

		password = result;

		isGenerating = false;
	};

	/** Copy password to clipboard */
	async function copyPassword() {
		if (!password) {
			toast.error('Generate a password first');
			return;
		}

		try {
			await navigator.clipboard.writeText(String(password));
			copied = true;
			toast.success('Password copied to clipboard');
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			toast.error('Failed to copy password');
		}
	}

	onMount(() => {
		if (!password) generatePassword();
	});
</script>

<DialogComp title="Generate Password" IconComp={ShieldCheckIcon} variant="default">
	<Card class="shadow-lg-lg w-full max-w-md">
		<CardHeader class="pb-4">
			<div class="flex items-center gap-3">
				<div class="flex size-10 items-center justify-center rounded-lg bg-primary/10">
					<ShieldCheckIcon class="size-5 text-primary" />
				</div>
				<div>
					<CardTitle class="text-xl">Password Generator</CardTitle>
					<CardDescription>Create a secure, random password</CardDescription>
				</div>
			</div>
		</CardHeader>

		<CardContent class="space-y-6">
			<!-- Password Display -->
			<div class="flex flex-col gap-2">
				<Label class="text-sm font-medium">Generated Password</Label>
				<div class="relative">
					<Input
						type={showPassword ? 'text' : 'password'}
						value={password}
						class="h-12 pr-24 font-mono text-base tracking-wide"
					/>
					<div class="absolute top-1/2 right-1 flex -translate-y-1/2 gap-1">
						<Button
							size="icon"
							variant="ghost"
							class="size-8 hover:bg-muted"
							onclick={() => (showPassword = !showPassword)}
						>
							{#if showPassword}
								<EyeOffIcon class="size-4" />
							{:else}
								<EyeIcon class="size-4" />
							{/if}
						</Button>
						<Button
							size="icon"
							variant="ghost"
							class="size-8 hover:bg-muted"
							onclick={copyPassword}
						>
							{#if copied}
								<CheckIcon class="size-4 text-green-500" />
							{:else}
								<CopyIcon class="size-4" />
							{/if}
						</Button>
					</div>
				</div>

				<!-- Strength Indicator -->
				<div class="space-y-1.5">
					<div class="flex items-center justify-between text-xs">
						<span class="text-muted-foreground">Password Strength</span>
						<span class="font-medium">{passwordStrength.label}</span>
					</div>
					<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							class={[
								'h-full rounded-full transition-all duration-500',
								passwordStrength.color,
								passwordStrength.width
							]}
						></div>
					</div>
				</div>
			</div>

			<!-- Password Length -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<Label class="text-sm font-medium">Password Length</Label>
					<span class="rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums">
						{passwordLength}
					</span>
				</div>
				<Input bind:value={passwordLength} type="range" class="pl-4" min={8} max={32} step={1} />
				<div class="flex justify-between text-xs text-muted-foreground">
					<span>8</span>
					<span>32</span>
				</div>
			</div>

			<!-- Character Options -->
			<div class="space-y-3">
				<Label class="text-sm font-medium">Character Types</Label>
				{#if !includes}
					<p class="text-center text-destructive">You must select at least one character type</p>
				{/if}

				<div class="grid grid-cols-2 gap-3">
					<div class="flex items-center justify-between rounded-lg border p-3">
						<Label class="cursor-pointer text-sm">Uppercase (A-Z)</Label>
						<Switch bind:checked={includeUppercase} />
					</div>
					<div class="flex items-center justify-between rounded-lg border p-3">
						<Label class="cursor-pointer text-sm">Lowercase (a-z)</Label>
						<Switch bind:checked={includeLowercase} />
					</div>
					<div class="flex items-center justify-between rounded-lg border p-3">
						<Label class="cursor-pointer text-sm">Numbers (0-9)</Label>
						<Switch bind:checked={includeNumbers} />
					</div>
					<div class="flex items-center justify-between rounded-lg border p-3">
						<Label class="cursor-pointer text-sm">Symbols (!@#)</Label>
						<Switch bind:checked={includeSymbols} />
					</div>
				</div>
			</div>

			<!-- Generate Button -->
			<Button
				class="h-11 w-full gap-2 text-base font-semibold"
				onclick={generatePassword}
				disabled={isGenerating || !includes}
				title={!includes
					? 'You must select at least one character types'
					: isGenerating
						? 'Generating Password'
						: 'Generate Password'}
			>
				<RefreshCwIcon class={['size-4', isGenerating && 'animate-spin']} />
				Generate New Password
			</Button>
		</CardContent>
	</Card>
</DialogComp>
