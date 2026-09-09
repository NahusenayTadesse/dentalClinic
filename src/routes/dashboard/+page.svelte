<script lang="ts">
	import AppointmentCard from '$lib/components/dashboard/appointment-card.svelte';
	import ReorderList from '$lib/components/dashboard/reorder-list.svelte';
	import { PackageIcon, BoxIcon } from '@lucide/svelte';

	import Reports from '$lib/components/dashboard/reports.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';

	let { data } = $props();

	let urgentContracts = $derived(
		data?.expiringContracts?.filter((c) => c.daysRemaining !== null && c.daysRemaining < 30)
	);

	// Sort by most urgent (closest to 0 or negative)
	let sortedUrgent = $derived(
		[...urgentContracts].sort((a, b) => a.daysRemaining - b.daysRemaining)
	);
</script>

<svelte:head>
	<title>Dashboard</title>
</svelte:head>

<div
	class="min-h-dvh w-full rounded-lg border bg-linear-to-br from-background/10 via-background/10
 to-muted/30 backdrop-blur-md transition-colors duration-300"
>
	<!-- Header Section -->
	<div
		class="rounded-xl border-b border-border/50 bg-linear-to-r from-primary/5 via-accent/5
	 to-secondary/5 shadow-sm backdrop-blur-sm"
	>
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between">
				<div class="space-y-1">
					<h1
						class="bg-linear-to-r from-primary to-black bg-clip-text text-3xl font-bold text-transparent dark:to-white"
					>
						Dashboard
					</h1>
					<p class="text-sm text-muted-foreground">Welcome back! Here's your daily overview.</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
		{#if sortedUrgent.length > 0}
			<section
				class="mb-8 w-auto justify-self-center overflow-hidden rounded-xl border border-red-200 bg-red-50 p-1 shadow-lg transition-all dark:border-red-900/50 dark:bg-red-950/30"
			>
				<div class="flex items-center gap-3 px-4 py-3 text-red-800 dark:text-red-200">
					<div class="relative flex h-3 w-3">
						<span
							class="absolute inline-flex h-full w-full scale-200 animate-ping rounded-full bg-red-400 opacity-75"
						></span>
						<span class="relative inline-flex h-3 w-3 scale-200 rounded-full bg-red-600"></span>
					</div>

					<h3 class="text-sm font-bold tracking-wider uppercase">
						Urgent: {sortedUrgent.length}
						{sortedUrgent.length === 1 ? 'Contract' : 'Contracts'} Expiring Soon
					</h3>
				</div>

				<div class="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each sortedUrgent as contract (contract.id)}
						<div
							class="group relative flex flex-col justify-between rounded-lg border border-red-200 bg-white p-4 shadow-sm transition-colors hover:bg-red-100/50 dark:border-red-800/40 dark:bg-neutral-900 dark:hover:bg-red-900/20"
						>
							<div>
								<div class="flex items-start justify-between">
									<h4 class="font-bold text-neutral-900 dark:text-white">
										{contract.site}
									</h4>
									<span class="text-xs font-medium text-red-600 dark:text-red-400">
										{contract.daysRemaining <= 0 ? 'Expired' : `${contract.daysRemaining}d left`}
									</span>
								</div>
								<p class="text-sm text-neutral-500 dark:text-neutral-400">
									{contract.service}
								</p>
							</div>

							<div
								class="mt-3 flex items-center justify-between border-t border-red-100 pt-3 dark:border-red-900/30"
							>
								<span class="text-xs text-neutral-400">
									Ends: {formatEthiopianDate(new Date(contract.endDate))}
								</span>
								<a
									href="/dashboard/contracts/{contract.id}/payment-history"
									class="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
								>
									Renew →
								</a>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}
		<Reports report={data.todayReport} />

		<!-- Stats Grid -->
		<!-- <div class="mb-8 grid gap-6">
			<AppointmentCard count={data.nofAppointments} />
		</div> -->

		<!-- Reorder Items Grid -->
		<div class="mb-8 grid gap-6 md:grid-cols-2">
			<ReorderList
				title="Supplies to Reorder"
				description="Items below reorder level"
				items={data.reorderSupplies}
				icon={BoxIcon}
			/>
		</div>

		<!-- Report Section -->
	</div>
</div>
