<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '$lib/components/ui/card';
	import { Wallet } from '@lucide/svelte';
	import SummaryCard from './summary-card.svelte';
	import AccountItem from './account-item.svelte';
	interface BankAccount {
		id: number;
		paymentMethod: string;
		account: string;
		amount: number;
	}
	let { bankAccounts }: { bankAccounts: BankAccount[] } = $props();

	// Calculate total balance
	const totalBalance = $derived(bankAccounts.reduce((sum, acc) => sum + Number(acc.amount), 0));
</script>

<div class="mx-auto w-full space-y-6">
	<!-- Summary Card -->
	<SummaryCard {totalBalance} accountCount={bankAccounts.length} />

	<!-- Accounts List -->
	<Card>
		<CardHeader class="pb-4">
			<div class="flex items-center justify-between">
				<div>
					<CardTitle class="text-xl">Bank Accounts</CardTitle>
				</div>
			</div>
		</CardHeader>
		<CardContent class="grid grid-cols-1 gap-2 lg:grid-cols-3">
			{#each bankAccounts as account (account.id)}
				<AccountItem {account} />
			{/each}

			{#if bankAccounts.length === 0}
				<div class="py-12 text-center text-muted-foreground">
					<Wallet class="mx-auto mb-4 size-12 opacity-50" />
					<p class="font-medium">No accounts found</p>
					<p class="text-sm">Add your first bank account to get started</p>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
