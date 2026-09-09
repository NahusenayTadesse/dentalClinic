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

<Card
	class="shadow-lg-lg shadow-lg-primary/20 border-0 bg-linear-to-br from-primary to-primary/80 text-primary-foreground"
>
	<CardContent class="p-6">
		<div class="flex items-center justify-between">
			<div class="space-y-1">
				<p class="text-sm font-medium text-primary-foreground/80">Total Balance</p>
				<p class="text-3xl font-bold tracking-tight">{formatETB(totalBalance, true)}</p>
				<p class="flex items-center gap-1 text-sm text-primary-foreground/70">
					<TrendingUpIcon class="size-4" />
					Across {accountCount}
					{accountCount === 1 ? 'Account' : 'Accounts'}
				</p>
			</div>
			<div class="flex size-14 items-center justify-center rounded-full bg-primary-foreground/20">
				<Wallet class="size-7" />
			</div>
		</div>
	</CardContent>
</Card>
