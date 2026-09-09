<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
	import { Badge } from "$lib/components/ui/badge";
	import { TrendingUpIcon, TrendingDownIcon, ShoppingBagIcon, UserCheckIcon, DollarSignIcon, CreditCardIcon, ClipboardListIcon, UsersIcon } from "@lucide/svelte";

	type TodayReport = {
		id: number;
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
	const netIncome = $derived(report ? report.dailyIncome - report.dailyExpenses - report.staffPaid : 0);
	const isPositive = $derived(netIncome >= 0);

	// Format currency
	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "ETB",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
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
		<div class="grid grid-cols-1 gap-4 lg:gap-8 md:grid-cols-2 lg:grid-cols-2">
			<!-- Daily Income -->
			<Card class="border-l-4 border-l-emerald-500 hover:shadow-lg-lg transition-shadow-lg duration-200">
				<CardHeader class="pb-2">
					<CardTitle class="flex items-center justify-between text-sm font-medium text-muted-foreground">
						<span>Daily Income</span>
						<TrendingUpIcon class="size-4 text-emerald-500" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-emerald-600">{formatCurrency(report.dailyIncome)}</div>
					<p class="text-xs text-muted-foreground mt-1">{report.transactions} Transactions</p>
				</CardContent>
			</Card>

			<!-- Daily Expenses -->
			<Card class="border-l-4 border-l-red-500 hover:shadow-lg-lg transition-shadow-lg duration-200">
				<CardHeader class="pb-2">
					<CardTitle class="flex items-center justify-between text-sm font-medium text-muted-foreground">
						<span>Daily Expenses</span>
						<TrendingDownIcon class="size-4 text-red-500" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-red-600">{formatCurrency(report.dailyExpenses)}</div>
					<p class="text-xs text-muted-foreground mt-1">Operational costs</p>
				</CardContent>
			</Card>

			<!-- Staff Paid -->
			<Card class="border-l-4 border-l-blue-500 hover:shadow-lg-lg transition-shadow-lg duration-200">
				<CardHeader class="pb-2">
					<CardTitle class="flex items-center justify-between text-sm font-medium text-muted-foreground">
						<span>Staff Paid</span>
						<UsersIcon class="size-4 text-blue-500" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-blue-600">{formatCurrency(report.staffPaid)}</div>
					<p class="text-xs text-muted-foreground mt-1">Payroll</p>
				</CardContent>
			</Card>

			<!-- Net Income -->
			<Card class={["border-l-4 hover:shadow-lg-lg transition-shadow-lg duration-200", isPositive ? "border-l-green-500" : "border-l-orange-500"]}>
				<CardHeader class="pb-2">
					<CardTitle class="flex items-center justify-between text-sm font-medium text-muted-foreground">
						<span>Net Income</span>
						<DollarSignIcon class={["size-4", isPositive ? "text-green-500" : "text-orange-500"]} />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class={["text-2xl font-bold", isPositive ? "text-green-600" : "text-orange-600"]}>{formatCurrency(netIncome)}</div>
					<p class="text-xs text-muted-foreground mt-1">{isPositive ? "Profit" : "Loss"}</p>
				</CardContent>
			</Card>
		</div>

		<!-- Secondary Metrics -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			<!-- Booked Appointments -->
			<Card class="hover:shadow-lg-lg transition-shadow-lg duration-200">
				<CardHeader class="pb-2">
					<CardTitle class="flex items-center justify-between text-sm font-medium text-muted-foreground">
						<span>Appointments</span>
						<UserCheckIcon class="size-4 text-primary" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-primary">{report.bookedAppointments}</div>
					<p class="text-xs text-muted-foreground mt-1">Booked today</p>
				</CardContent>
			</Card>

			<!-- Products Sold -->
			<Card class="hover:shadow-lg-lg transition-shadow-lg duration-200">
				<CardHeader class="pb-2">
					<CardTitle class="flex items-center justify-between text-sm font-medium text-muted-foreground">
						<span>Products Sold</span>
						<ShoppingBagIcon class="size-4 text-amber-500" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-amber-600">{report.productsSold}</div>
					<p class="text-xs text-muted-foreground mt-1">Units sold</p>
				</CardContent>
			</Card>

			<!-- Services Rendered -->
			<Card class="hover:shadow-lg transition-shadow duration-200">
				<CardHeader class="pb-2">
					<CardTitle class="flex items-center justify-between text-sm font-medium text-muted-foreground">
						<span>Services</span>
						<ClipboardListIcon class="size-4 text-violet-500" />
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-violet-600">{report.serviceRendered}</div>
					<p class="text-xs text-muted-foreground mt-1">Completed</p>
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

