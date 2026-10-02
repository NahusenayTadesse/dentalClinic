<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import {
		TrendingUpIcon,
		TrendingDownIcon,
		ShoppingBagIcon,
		UserCheckIcon,
		DollarSignIcon,
		ClipboardListIcon,
		UsersIcon
	} from '@lucide/svelte';

	type TodayReport = {
		bookedAppointments: number;
		productsSold: number;
		serviceRendered: number;
		dailyExpenses: number;
		staffPaid: number;
		dailyIncome: number;
		transactions: number;
	};

	let { report }: { report: TodayReport } = $props();

	// Calculate net income
	const netIncome = $derived(
		report ? report.dailyIncome - report.dailyExpenses - report.staffPaid : 0
	);
	const isPositive = $derived(netIncome >= 0);

	// Format currency
	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'ETB',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(value);
	};
</script>

{#if report}
	<div class="flex flex-col gap-4">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-bold text-foreground">Today's Report</h2>
				<p class="text-sm text-muted-foreground">Real-time business metrics</p>
			</div>
			<Badge variant="outline" class="text-xs">Live</Badge>
		</div>

		<!-- Main Metrics Grid -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2 lg:gap-8">
			<!-- Daily Income -->
			<Card>
				<CardHeader class="pb-2">
					<CardTitle
						class="flex items-center justify-between text-sm font-medium text-muted-foreground"
					>
						<span>Daily Income</span>
						<TrendingUpIcon class="size-4 text-muted-foreground" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-semibold">
						{formatCurrency(report.dailyIncome)}
					</div>
					<p class="mt-1 text-xs text-muted-foreground">{report.transactions} Transactions</p>
				</CardContent>
			</Card>

			<!-- Daily Expenses -->
			<Card>
				<CardHeader class="pb-2">
					<CardTitle
						class="flex items-center justify-between text-sm font-medium text-muted-foreground"
					>
						<span>Daily Expenses</span>
						<TrendingDownIcon class="size-4 text-muted-foreground" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-semibold">{formatCurrency(report.dailyExpenses)}</div>
					<p class="mt-1 text-xs text-muted-foreground">Operational costs</p>
				</CardContent>
			</Card>

			<!-- Staff Paid -->
			<Card>
				<CardHeader class="pb-2">
					<CardTitle
						class="flex items-center justify-between text-sm font-medium text-muted-foreground"
					>
						<span>Staff Paid</span>
						<UsersIcon class="size-4 text-muted-foreground" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-semibold">{formatCurrency(report.staffPaid)}</div>
					<p class="mt-1 text-xs text-muted-foreground">Payroll</p>
				</CardContent>
			</Card>

			<!-- Net Income -->
			<Card>
				<CardHeader class="pb-2">
					<CardTitle
						class="flex items-center justify-between text-sm font-medium text-muted-foreground"
					>
						<span>Net Income</span>
						<DollarSignIcon class="size-4 text-muted-foreground" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class={['text-2xl font-semibold', !isPositive && 'text-destructive']}>
						{formatCurrency(netIncome)}
					</div>
					<p class="mt-1 text-xs text-muted-foreground">{isPositive ? 'Profit' : 'Loss'}</p>
				</CardContent>
			</Card>
		</div>

		<!-- Secondary Metrics -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			<!-- Booked Appointments -->
			<Card class="hover:shadow-lg-lg transition-shadow-lg duration-200">
				<CardHeader class="pb-2">
					<CardTitle
						class="flex items-center justify-between text-sm font-medium text-muted-foreground"
					>
						<span>Appointments</span>
						<UserCheckIcon class="size-4 text-muted-foreground" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-semibold">{report.bookedAppointments}</div>
					<p class="mt-1 text-xs text-muted-foreground">Booked today</p>
				</CardContent>
			</Card>

			<!-- Products Sold -->
			<Card class="hover:shadow-lg-lg transition-shadow-lg duration-200">
				<CardHeader class="pb-2">
					<CardTitle
						class="flex items-center justify-between text-sm font-medium text-muted-foreground"
					>
						<span>Products Sold</span>
						<ShoppingBagIcon class="size-4 text-muted-foreground" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-semibold">{report.productsSold}</div>
					<p class="mt-1 text-xs text-muted-foreground">Units sold</p>
				</CardContent>
			</Card>

			<!-- Services Rendered -->
			<Card class="transition-shadow duration-200 hover:shadow-lg">
				<CardHeader class="pb-2">
					<CardTitle
						class="flex items-center justify-between text-sm font-medium text-muted-foreground"
					>
						<span>Services</span>
						<ClipboardListIcon class="size-4 text-muted-foreground" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-semibold">{report.serviceRendered}</div>
					<p class="mt-1 text-xs text-muted-foreground">Completed</p>
				</CardContent>
			</Card>
		</div>
	</div>
{:else}
	<Card class="border-dashed">
		<CardContent class="flex items-center justify-center py-8">
			<p class="text-muted-foreground">No report data available for today</p>
		</CardContent>
	</Card>
{/if}
