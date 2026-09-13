<script lang="ts">
	import AppointmentCard from '$lib/components/dashboard/appointment-card.svelte';
	import ReorderList from '$lib/components/dashboard/reorder-list.svelte';
	import { PackageIcon, BoxIcon } from '@lucide/svelte';

	import Reports from '$lib/components/dashboard/reports.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Dashboard</title>
</svelte:head>

<div class="min-h-dvh w-full">
	<!-- Header Section -->
	<div class="border-b">
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between">
				<div class="space-y-1">
					<h1 class="text-2xl font-semibold">Dashboard</h1>
					<p class="text-sm text-muted-foreground">Welcome back! Here's your daily overview.</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
		<!-- The expiring-contracts banner lived here. It belonged to the client-billing
		     tables that went with the prune; the clinic needs its own headline. -->
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
