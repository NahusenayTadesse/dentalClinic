<script lang="ts">
	import { applyQueryToUrl, navigateWithQuery } from '$lib/queryFilters';
	import QueryBuilder from '$lib/QueryBuilder.svelte';
	import RequestFilters from '../RequestFilters.svelte';
	import Receipt from '../Receipt.svelte';
	import { idsField } from '../receipts';
	import Button from '$lib/components/ui/button/button.svelte';
	import DeleteEntity from '$lib/components/DeleteEntity.svelte';
	import { FileText, Loader, ArrowDownNarrowWide, Images, Frown } from '@lucide/svelte';

	let { data } = $props();

	let isExporting = $state(false);
	let exportProgress = $state('');

	const totalPages = $derived(Math.ceil(data.pagination.total / data.pagination.pageSize));

	const periodLabel = (months: { month: string; year: number }[]) => {
		if (months.length === 1) return `${months[0].month} ${months[0].year}`;
		const first = months[0];
		const last = months[months.length - 1];
		return `${months.length} months · ${first.month} ${first.year} – ${last.month} ${last.year}`;
	};

	/** The filename an invoice exports under: site, then the period it covers. */
	const exportName = (
		siteName: string | null | undefined,
		months: { month: string; year: number }[]
	) => {
		const site = (siteName ?? 'Site').replace(/\s+/g, '-');
		const first = months[0];
		const last = months[months.length - 1];
		return months.length === 1
			? `${site}-${first.month}-${first.year}`
			: `${site}-${first.month}-${first.year}-to-${last.month}-${last.year}`;
	};

	// --- Export Logic ---
	const downloadAllPDF = async () => {
		const { toPng } = await import('html-to-image');
		const { default: jsPDF } = await import('jspdf');
		const elements = document.querySelectorAll('.invoice-page');
		if (elements.length === 0) return;

		isExporting = true;
		try {
			const pdf = new jsPDF('p', 'mm', 'a4');

			for (let i = 0; i < elements.length; i++) {
				exportProgress = `Rendering ${i + 1} of ${elements.length}`;
				const el = elements[i] as HTMLElement;
				const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: '#fff' });

				const imgProps = pdf.getImageProperties(dataUrl);
				const pdfWidth = pdf.internal.pageSize.getWidth();
				const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

				if (i > 0) pdf.addPage();
				pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
			}

			pdf.save(`Batch-Invoices.pdf`);
		} catch (err) {
			console.error('Export failed', err);
		} finally {
			isExporting = false;
			exportProgress = '';
		}
	};

	const downloadAllSeparate = async (format: 'pdf' | 'png') => {
		const { toPng } = await import('html-to-image');
		const { default: jsPDF } = await import('jspdf');
		const elements = document.querySelectorAll('.invoice-page');
		if (elements.length === 0) return;

		isExporting = true;

		for (let i = 0; i < elements.length; i++) {
			exportProgress = `Downloading ${i + 1} of ${elements.length}`;
			const el = elements[i] as HTMLElement;

			// Extract Site Name from the data attribute we'll add to the HTML
			const siteName = el.getAttribute('data-sitename') || 'Site';
			const fileName = siteName;

			try {
				const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: '#fff' });

				if (format === 'png') {
					const link = document.createElement('a');
					link.download = `${fileName}.png`;
					link.href = dataUrl;
					link.click();
				} else {
					const pdf = new jsPDF('p', 'mm', 'a4');
					const imgProps = pdf.getImageProperties(dataUrl);
					const pdfWidth = pdf.internal.pageSize.getWidth();
					const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

					pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
					pdf.save(`${fileName}.pdf`);
				}

				// Small delay to prevent browser download blocking
				await new Promise((resolve) => setTimeout(resolve, 500));
			} catch (err) {
				console.error(`Export failed for ${siteName}:`, err);
			}
		}
		isExporting = false;
		exportProgress = '';
	};
</script>

<svelte:head>
	<title>Approved Requests</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center p-4 lg:p-8">
	<header
		class="mx-auto mb-8 w-full max-w-305! rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="flex flex-wrap items-center justify-between gap-6">
			<div>
				<h1 class="text-2xl font-black tracking-tight">Approved Requests</h1>
				<p class="text-sm text-zinc-500">Most recently approved first.</p>
				<p class="text-sm text-zinc-500">
					{data.pagination.total} approved invoice{data.pagination.total === 1 ? '' : 's'}
					{#if totalPages > 1}
						· showing {data.receipts.length} on page {data.pagination.page} of {totalPages}
					{/if}
				</p>
			</div>

			<div class="flex flex-wrap gap-2">
				<Button
					disabled={isExporting || data.receipts.length === 0}
					onclick={downloadAllPDF}
					class="bg-zinc-900 text-white hover:bg-zinc-800"
				>
					{#if isExporting}
						<Loader class="mr-2 h-4 w-4 animate-spin" />
						{exportProgress || 'Processing...'}
					{:else}
						<ArrowDownNarrowWide class="mr-2 h-4 w-4" />
						Export In One File
					{/if}
				</Button>

				<Button
					disabled={isExporting || data.receipts.length === 0}
					onclick={() => downloadAllSeparate('pdf')}
					class="bg-zinc-900 text-white hover:bg-zinc-800"
				>
					{#if isExporting}
						<Loader class="mr-2 h-4 w-4 animate-spin" />
						{exportProgress || 'Downloading...'}
					{:else}
						<FileText class="mr-2 h-4 w-4" />
						Separate PDFs
					{/if}
				</Button>

				<Button
					disabled={isExporting || data.receipts.length === 0}
					onclick={() => downloadAllSeparate('png')}
					class="bg-zinc-900 text-white hover:bg-zinc-800"
				>
					{#if isExporting}
						<Loader class="mr-2 h-4 w-4 animate-spin" />
						{exportProgress || 'Downloading...'}
					{:else}
						<Images class="mr-2 h-4 w-4" />
						Separate PNGs
					{/if}
				</Button>
			</div>
		</div>
		<p class="mt-3 text-xs text-zinc-400">
			Export covers the {data.receipts.length} invoice{data.receipts.length === 1 ? '' : 's'} on this
			page. Raise the page size in the query bar to cover more in one file.
		</p>
	</header>

	<div class="w-full max-w-305!">
		<QueryBuilder
			title="Requests Query"
			description="Server-side search across approved requests"
			showDate
			totalResults={data.pagination.total}
			searchPlaceholder="Search site, customer or invoice number..."
			initialSearch={data.currentQuery.search}
			initialStart={data.currentQuery.dateStart ?? undefined}
			initialEnd={data.currentQuery.dateEnd ?? undefined}
			initialPageSize={data.pagination.pageSize}
			defaultPageSize={10}
			initialCustomFilters={{
				month: data.currentQuery.month ?? '',
				year: data.currentQuery.year ?? '',
				customerId: data.currentQuery.customerId ?? '',
				requestedBy: data.currentQuery.requestedBy ?? '',
				approvedBy: data.currentQuery.approvedBy ?? ''
			}}
			onQueryChange={applyQueryToUrl}
		>
			{#snippet children(filters, update)}
				<RequestFilters {filters} {update} filterOptions={data.filterOptions} showApprovedBy />
			{/snippet}
		</QueryBuilder>
	</div>

	{#if data.receipts.length === 0}
		<div class="flex h-96 flex-col items-center justify-center gap-4">
			<p class="flex flex-row gap-4 text-center text-3xl">
				<Frown class="h-10 w-14 animate-bounce" />
				No approved requests match this query
			</p>
			<p class="text-sm text-zinc-500">
				Clear the filters in the query bar, or approve something from the pending queue.
			</p>
			<Button variant="outline" href="/dashboard/requests/pending">Go to pending requests</Button>
		</div>
	{:else}
		<!-- Invoices Preview -->
		<div class="mt-8 flex flex-col items-center gap-16 pb-8">
			{#each data.receipts as receipt (receipt.key)}
				<Receipt
					invoiceNumber={receipt.invoiceNumber}
					siteId={receipt.siteId}
					siteName={receipt.head.siteName}
					customerName={receipt.head.customerName}
					requestDate={receipt.head.requestDate}
					months={receipt.months}
					contracts={data.contracts}
					vat={data.vats.vat}
					withhold={data.vats.withHold}
					employees={data.employees}
					requestedBy={receipt.head.requestedBy}
					approvedBy={receipt.head.approvedBy}
					exportName={exportName(receipt.head.siteName, receipt.months)}
					showClientSignature
				/>

				{#if data?.isSuperAdmin}
					<div class="flex w-full max-w-212.5 justify-end">
						<DeleteEntity
							entity="Payment Request"
							name="{receipt.invoiceNumber} ({periodLabel(receipt.months)})"
							consequence={receipt.ids.length > 1
								? `All ${receipt.ids.length} months on this invoice are removed together.`
								: ''}
							id={idsField(receipt.ids)}
							canDelete={data?.isSuperAdmin}
						/>
					</div>
				{/if}
			{/each}
		</div>

		{#if totalPages > 1}
			<div
				class="mb-16 flex w-full max-w-212.5 items-center justify-between text-sm text-muted-foreground"
			>
				<span>Page {data.pagination.page} of {totalPages}</span>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={data.pagination.page <= 1}
						onclick={() => navigateWithQuery({ page: data.pagination.page - 1 })}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={data.pagination.page >= totalPages}
						onclick={() => navigateWithQuery({ page: data.pagination.page + 1 })}
					>
						Next
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</div>
