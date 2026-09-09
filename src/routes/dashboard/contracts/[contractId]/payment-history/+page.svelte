<script lang="ts">
	import { columns, makeRenewalColumns } from './columns';

	let { data } = $props();

	import DataTable from '$lib/components/Table/data-table.svelte';

	import Loading from '$lib/components/Loading.svelte';
	import { Banknote, Building2, ExternalLink, Frown, MapPin, PhoneIcon } from '@lucide/svelte';
	import FilterMenu from '$lib/components/Table/FilterMenu.svelte';

	let filteredList = $derived(data?.payments);
	let renewalList = $derived(data?.renewalHistory);
	let renewalColumns = $derived(makeRenewalColumns(data?.isSuperAdmin));

	import { Toaster } from 'svelte-sonner';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import {
		DownloadIcon,
		PencilIcon,
		TrashIcon,
		CalendarIcon,
		DollarSignIcon,
		FileIcon,
		UserIcon
	} from '@lucide/svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import Statuses from '$lib/components/Table/statuses.svelte';
	import EditContract from './editContract.svelte';
	import Renew from './renew.svelte';

	const contract = $derived(data?.contracts);

	const calculateAnnualAmount = (monthly: number) => {
		return formatETB(monthly * 12, true);
	};

	const getDaysRemaining = (endDate: string | Date) => {
		const end = endDate instanceof Date ? endDate : new Date(endDate);
		const today = new Date();
		const diff = end.getTime() - today.getTime();
		const days = Math.ceil(diff / (1000 * 3600 * 24));
		return days > 0 ? days : 0;
	};
</script>

<svelte:head>
	<title>{data?.contracts?.contractYear} Payment History</title>
</svelte:head>

{#if contract.terminated}
	<div class="overflow-hidden rounded-xl border border-destructive/40 bg-destructive/5 shadow-sm">
		<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
			<!-- Left Side: Reason -->
			<div class="space-y-1">
				<span
					class="inline-flex items-center rounded-md bg-destructive px-2 py-0.5 text-xs font-bold tracking-wider text-white uppercase"
				>
					Contract Terminated
				</span>
				<h3 class="text-2xl font-bold tracking-tight text-foreground">
					{contract.terminationReason}
				</h3>
			</div>

			<!-- Right Side: Date -->
			<div class="flex flex-col sm:items-end">
				<p class="text-xs font-semibold text-muted-foreground uppercase">Effective Date</p>
				<p class="font-mono text-xl font-bold text-destructive">
					{formatEthiopianDate(contract.terminationDate)}
				</p>
			</div>
		</div>
	</div>
{/if}

<div class="min-h-dvh transition-colors">
	<!-- Header -->
	<div
		class="sticky top-12 z-40 rounded-lg border-b border-l-4 border-l-primary bg-background/95 backdrop-blur-sm"
	>
		<div class="mx-auto px-4 py-4 sm:px-6 lg:px-8">
			<div class="flex items-start justify-between gap-4">
				<div class="flex-1">
					<h1 class="text-3xl font-bold tracking-tight">{contract.serviceName}</h1>
					<p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
						<span>Contract ID: #{contract.id}</span>
						<span>&bull;</span>
						<a href={`/dashboard/sites/${contract.site}`} class="font-medium text-primary hover:underline">
							{contract.siteName}
						</a>
						{#if contract.customerName}
							<span>&bull;</span>
							<span>{contract.customerName}</span>
						{/if}
					</p>
				</div>
				<div class="flex items-center gap-2">
					<Statuses status={contract.status ? 'Active' : 'Inactive'} />
					{#if contract.inActiveReason}
						<p class="text-sm text-muted-foreground">{contract.inActiveReason}</p>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="mx-auto px-4 py-8 sm:px-6 lg:px-4">
		<!-- Quick Stats -->
		<div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card class="border-l-4 border-l-primary">
				<CardContent class="pt-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-muted-foreground">Monthly Amount</p>
							<p class="mt-2 text-2xl font-bold">
								{formatETB(Number(contract.monthlyAmount), true)}
							</p>
						</div>
						<Banknote class="size-8 text-primary/20" />
					</div>
				</CardContent>
			</Card>

			<Card class="border-l-4 border-l-accent">
				<CardContent class="pt-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-muted-foreground">Annual Amount</p>
							<p class="mt-2 text-2xl font-bold">
								{calculateAnnualAmount(Number(contract.monthlyAmount))}
							</p>
						</div>
						<DollarSignIcon class="size-8 text-accent/20" />
					</div>
				</CardContent>
			</Card>

			<Card class="border-l-4 border-l-chart-2">
				<CardContent class="pt-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-muted-foreground">Days Remaining</p>
							<p class="mt-2 text-2xl font-bold">{getDaysRemaining(contract.endDate)}</p>
						</div>
						<CalendarIcon class="size-8 text-chart-2/20" />
					</div>
				</CardContent>
			</Card>

			<Card class="border-l-4 border-l-chart-3">
				<CardContent class="pt-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-muted-foreground">Contract Year</p>
							<p class="mt-2 text-2xl font-bold">{contract.contractYear}</p>
						</div>
						<CalendarIcon class="size-8 text-chart-3/20" />
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Contract Details -->
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- Main Details -->
			<div class="space-y-6 lg:col-span-2">
				<!-- Dates Section -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<CalendarIcon class="size-5" />
							Contract Dates
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<p class="text-sm font-medium text-muted-foreground">Start Date</p>
								<p class="mt-1 text-lg font-semibold">{formatEthiopianDate(contract.startDate)}</p>
							</div>
							<div>
								<p class="text-sm font-medium text-muted-foreground">End Date</p>
								<p class="mt-1 text-lg font-semibold">{formatEthiopianDate(contract.endDate)}</p>
							</div>
						</div>
						<Separator />
						<div>
							<p class="text-sm font-medium text-muted-foreground">Signed Date</p>
							<p class="mt-1 text-lg font-semibold">{formatEthiopianDate(contract.signedDate)}</p>
						</div>
					</CardContent>
				</Card>

				<!-- Financial Details -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<DollarSignIcon class="size-5" />
							Financial Information
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<p class="text-sm font-medium text-muted-foreground">Monthly Amount</p>
								<p class="mt-1 text-lg font-semibold">
									{formatETB(Number(contract.monthlyAmount), true)}
								</p>
							</div>
							<div>
								<p class="text-sm font-medium text-muted-foreground">Annual Amount</p>
								<p class="mt-1 text-lg font-semibold">
									{calculateAnnualAmount(Number(contract.monthlyAmount))}
								</p>
							</div>
						</div>
						<Separator />
						<div class="flex items-center justify-between">
							<p class="text-sm font-medium text-muted-foreground">Office Commission Considered</p>
							<Statuses status={contract.officeCommission ? 'Yes' : 'No'} />
						</div>
					</CardContent>
				</Card>

				<!-- Document Section -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<FileIcon class="size-5" />
							Contract Document
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="flex items-center justify-between rounded-lg border border-dashed p-4">
							<div class="flex items-center gap-3">
								<FileIcon class="size-6 text-muted-foreground" />
								<div>
									<p class="text-sm text-muted-foreground">
										{contract.contractFile.endsWith('.pdf') ? 'PDF' : 'Image'} Document
									</p>
								</div>
							</div>
							<Button
								size="sm"
								variant="outline"
								download="{contract.contractYear} Contract File"
								href={`/dashboard/files/${contract.contractFile}`}
								class="gap-2"
							>
								<DownloadIcon class="size-4" />
								Download Contract
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			<!-- Sidebar -->
			<div class="space-y-6">
				<!-- Site Section -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<Building2 class="size-5" />
							Site Information
						</CardTitle>
						<CardDescription>The site this contract is signed for.</CardDescription>
					</CardHeader>
					<CardContent class="space-y-4">
						<div>
							<p class="text-sm font-medium text-muted-foreground">Site Name</p>
							<p class="mt-1 font-semibold">{contract.siteName}</p>
						</div>

						{#if contract.customerName}
							<div>
								<p class="text-sm font-medium text-muted-foreground">Customer</p>
								<a
									href={`/dashboard/customers/${contract.customerId}`}
									class="mt-1 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
								>
									{contract.customerName}
									<ExternalLink class="size-3.5" />
								</a>
							</div>
						{/if}

						{#if contract.sitePhone}
							<div>
								<p class="text-sm font-medium text-muted-foreground">Phone</p>
								<a
									href={`tel:${contract.sitePhone}`}
									class="mt-1 inline-flex items-center gap-2 font-semibold hover:underline"
								>
									<PhoneIcon class="size-4 text-muted-foreground" />
									{contract.sitePhone}
								</a>
							</div>
						{/if}

						{#if contract.siteSubcity || contract.siteStreet || contract.siteKebele}
							<div>
								<p class="text-sm font-medium text-muted-foreground">Address</p>
								<p class="mt-1 flex items-start gap-2 font-semibold">
									<MapPin class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
									<span>
										{[
											contract.siteSubcity,
											contract.siteStreet,
											contract.siteKebele ? `Kebele ${contract.siteKebele}` : null
										]
											.filter(Boolean)
											.join(', ')}
									</span>
								</p>
							</div>
						{/if}

						<Separator />

						<div class="flex items-center justify-between">
							<span class="text-sm text-muted-foreground">Site Status</span>
							<Statuses status={contract.siteStatus ? 'Active' : 'Inactive'} />
						</div>
						{#if contract.siteStartDate}
							<div class="flex items-center justify-between">
								<span class="text-sm text-muted-foreground">Site Started On</span>
								<span class="font-semibold">{formatEthiopianDate(contract.siteStartDate)}</span>
							</div>
						{/if}
						<div class="flex items-center justify-between">
							<span class="text-sm text-muted-foreground">Office Commission</span>
							<Statuses status={contract.siteOfficeCommission ? 'Yes' : 'No'} />
						</div>

						<Button class="w-full gap-2" variant="outline" href={`/dashboard/sites/${contract.site}`}>
							<ExternalLink class="size-4" />
							View Site
						</Button>
					</CardContent>
				</Card>

				<!-- Officers Section -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<UserIcon class="size-5" />
							Officers
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div>
							<p class="text-sm font-medium text-muted-foreground">Signing Officer</p>
							<p class="mt-1 font-semibold">{contract.signingOfficer}</p>
						</div>
						<Separator />
						<div>
							<p class="text-sm font-medium text-muted-foreground">Added By</p>
							<p class="mt-1 font-semibold">{contract.addedBy}</p>
							<Button
								size="sm"
								variant="outline"
								target="_blank"
								href={`/dashboard/users/${contract.addedById}`}
							>
								<ExternalLink class="size-4" />
								View Profile
							</Button>
						</div>
					</CardContent>
				</Card>

				<!-- Actions -->
				<Card>
					<CardHeader>
						<CardTitle>Actions</CardTitle>
					</CardHeader>
					<CardContent class="w-full space-y-2">
						{#key data?.contracts}
							<Renew
								data={data?.renewForm}
								officers={data?.employees}
								monthlyAmount={contract.monthlyAmount}
								id={contract.id}
							/>
							<EditContract {...contract} siteList={data?.siteList} serviceList={data?.serviceList} data={data?.form} />
						{/key}

						<Button
							class="w-full gap-2"
							variant="outline"
							download="{contract.contractYear} Contract File"
							href={`/dashboard/files/${contract.contractFile}`}
						>
							<DownloadIcon class="size-4" />
							Download Original Contract
						</Button>
					</CardContent>
				</Card>

				<!-- Status Card -->
				<Card>
					<CardHeader>
						<CardTitle>Status</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-sm text-muted-foreground">Contract Status</span>
								<Statuses status={contract.status ? 'Active' : 'Inactive'} />
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-muted-foreground">Days Until Expiry</span>
								<span class="font-semibold">{getDaysRemaining(contract.endDate)} days</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>

		<Card class="my-8">
			<CardHeader>
				<CardTitle>Payment History</CardTitle>
			</CardHeader>
			<CardContent>
				{#if data.payments.length === 0}
					<div class="flex h-96 w-5xl items-center justify-center">
						<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
							<Frown class="h-12 w-16  animate-bounce" />
							No Payment History for this Contract
						</p>
					</div>
				{:else}
					<h4 class="my-4 text-2xl">
						No of Payments for this Contract:
						{data.payments?.length}
					</h4>

					<FilterMenu
						data={data?.payments}
						bind:filteredList
						filterKeys={[
							'invoiceNumber', // To find a specific bill
							'fsNumber', // For tax/audit purposes
							'month', // To filter by Amharic month names (e.g., "ሚያዝያ")
							'year', // To filter by budget year
							'addedBy' // To see which staff member processed the entry
						]}
					/>
					<DataTable
						data={filteredList}
						fileName="{contract.contractYear} Payment History"
						{columns}
					/>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>Renewal History</CardTitle>
			</CardHeader>
			<CardContent>
				{#if data.renewalHistory?.length === 0}
					<div class="flex h-96 w-5xl items-center justify-center">
						<p class="justify-self-cente mt-4 flex flex-row gap-4 text-center text-4xl">
							<Frown class="h-12 w-16  animate-bounce" />
							No Renewal History for this Contract
						</p>
					</div>
				{:else}
					<h4 class="my-4 text-2xl">
						No of Renewals for this Contract:
						{data.renewalHistory?.length}
					</h4>

					<FilterMenu
						data={data?.renewalHistory}
						bind:filteredList={renewalList}
						filterKeys={['signingOfficerName', 'addedBy', 'monthlyAmount']}
					/>
					<DataTable data={renewalList} fileName="Renewal History" columns={renewalColumns} />
				{/if}
			</CardContent>
		</Card>
	</div>
</div>
