<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { formatETB } from '$lib/global.svelte';
	import { Wallet, TrendingUpIcon } from '@lucide/svelte';

	interface Props {
		totalBalance: number;
		accountCount: number;
	}

	const { totalBalance, accountCount }: Props = $props();
</script>

<Card class="border bg-card text-card-foreground">
	<CardContent class="p-6">
		<div class="flex items-center justify-between">
			<div class="space-y-1">
				<p class="text-sm font-medium text-muted-foreground">Total Balance</p>
				<p class="text-3xl font-bold tracking-tight">{formatETB(totalBalance, true)}</p>
				<p class="flex items-center gap-1 text-sm text-muted-foreground">
					<TrendingUpIcon class="size-4" />
					Across {accountCount}
					{accountCount === 1 ? 'Account' : 'Accounts'}
				</p>
			</div>
			<div class="flex size-14 items-center justify-center rounded-full bg-muted">
				<Wallet class="size-7" />
			</div>
		</div>
	</CardContent>
</Card>
