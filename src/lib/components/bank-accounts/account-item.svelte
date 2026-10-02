<script lang="ts">
	import { Card, CardContent } from '@nahu/admin-kit/components/ui/card/index.js';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { BuildingIcon, CreditCardIcon, WalletIcon } from '@lucide/svelte';
	import { formatETB } from '$lib/global.svelte';
	import Copy from '@nahu/admin-kit/Copy.svelte';
	interface BankAccount {
		id: number;
		paymentMethod: string;
		account: string;
		amount: number;
	}
	interface Props {
		account: BankAccount;
	}

	const { account }: Props = $props();

	// Determine icon based on payment method
	const getIcon = (method: string) => {
		const lowerMethod = method.toLowerCase();
		if (lowerMethod.includes('paypal') || lowerMethod.includes('stripe')) {
			return WalletIcon;
		}
		if (lowerMethod.includes('card')) {
			return CreditCardIcon;
		}
		return BuildingIcon;
	};

	const IconComponent = $derived(getIcon(account.paymentMethod));
</script>

<Card class="hover:shadow-lg-md group transition-all duration-200 hover:border-primary/30">
	<CardContent class="p-2">
		<div class="flex items-center gap-4">
			<!-- Icon -->
			<div
				class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-primary/10"
			>
				<IconComponent
					class="size-6 text-muted-foreground transition-colors group-hover:text-primary"
				/>
			</div>

			<!-- Account Info -->
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<p class="truncate font-semibold text-foreground">{account.paymentMethod}</p>
				</div>
				<p class="font-mono text-sm text-muted-foreground"><Copy data={account.account} /></p>
			</div>

			<!-- Amount -->
			<div class="shrink-0 text-right">
				<p class="text-lg font-bold text-foreground">
					{formatETB(account.amount, true)}
				</p>
				<Badge variant="secondary" class="text-xs">Available</Badge>
			</div>
		</div>
	</CardContent>
</Card>
