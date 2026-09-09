<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte.js';
	import { Download, FileText, Image as ImageIcon, FileImage } from '@lucide/svelte';
	import MonthYear from '$lib/formComponents/MonthYear.svelte';
	import { toPng, toJpeg } from 'html-to-image';

	let { data } = $props();
	let elementRef: HTMLDivElement | null = $state(null);

	// --- State Management ---
	let monthYear = $state('');
	let fsNumber = $state('');
	let invoiceNumber = $state('');
	let penaltyAmount = $state<number>(0);
	let penaltyReason = $state('');
	let hasPenalty = $state(false);
	let vatRate = $derived(Number(data?.vats.vat));
	let withholdRate = $derived(Number(data?.vats.withHold));
	let requestDate = $state(new Date().toISOString().split('T')[0]);

	// --- Derived Calculations ---
	let siteName = $derived(data.contracts.siteName);
	let customerName = $derived(data?.contracts?.customerName);
	let contractMonthlyAmount = $derived(data?.contracts?.monthlyAmount || 0);
	let [m, y] = $derived(monthYear.split('_'));
	let selectedMonth = $derived(m || '---');
	let selectedYear = $derived(y || '---');

	let requestAmount = $derived(
		Math.max(0, Number(contractMonthlyAmount) - (hasPenalty ? penaltyAmount : 0))
	);
	let beforeVat = $derived(requestAmount / (1 + vatRate / 100));
	let vat = $derived(requestAmount - beforeVat);
	let withholdAmount = $derived(beforeVat * (withholdRate / 100));
	let paymentAmount = $derived(requestAmount - withholdAmount);

	// --- Helper Functions ---
	const fmt = (n: number) =>
		n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	const downloadImage = async (format: 'png' | 'jpeg') => {
		if (!elementRef) return;
		const fn = format === 'png' ? toPng : toJpeg;
		try {
			const dataUrl = await fn(elementRef, { quality: 0.95, backgroundColor: '#fff' });
			const link = document.createElement('a');
			link.download = `Invoice-${invoiceNumber || 'draft'}.${format}`;
			link.href = dataUrl;
			link.click();
		} catch (err) {
			console.error(`Export failed:`, err);
		}
	};
	import jsPDF from 'jspdf';
	import ComboboxComp from '$lib/formComponents/ComboboxComp.svelte';
	const downloadPDF = async () => {
		if (!elementRef) return;
		try {
			// 1. Capture as PNG for best quality/transparency
			const dataUrl = await toPng(elementRef, { pixelRatio: 2, backgroundColor: '#fff' });

			// 2. Initialize PDF (A4)
			const pdf = new jsPDF('p', 'mm', 'a4');
			const imgProps = pdf.getImageProperties(dataUrl);

			// 3. Calculate dimensions to fit the receipt on the page
			const pdfWidth = pdf.internal.pageSize.getWidth();
			const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

			// 4. Add image and save
			pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
			pdf.save(`Invoice-${invoiceNumber || 'draft'}.pdf`);
		} catch (err) {
			console.error(`PDF Export failed:`, err);
		}
	};

	let employee: number = $state();

	let disabled = $derived(monthYear === '' || invoiceNumber === '' || employee === undefined);
</script>

<svelte:head>
	<title>Paymetn Request</title>
</svelte:head>

<div
	class="min-h-screen bg-zinc-50 p-4 transition-colors duration-200 lg:p-8 dark:bg-zinc-950 dark:text-zinc-100"
>
	<header
		class="mx-auto mb-8 max-w-305! rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="flex flex-wrap items-center justify-between gap-6">
			<div>
				<h1 class="text-xl font-black tracking-tight">Receipt Generator</h1>
				<p class="text-xs text-zinc-500 dark:text-zinc-400">
					Manage billing and export professional invoices.
				</p>
			</div>

			<div class="flex items-center gap-2 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
				<Button
					variant="ghost"
					size="sm"
					class="h-8"
					{disabled}
					title={disabled ? 'Please fill in all basic info to export' : 'Export as PNG'}
					onclick={() => downloadImage('png')}
				>
					<ImageIcon class="mr-2 h-3.5 w-3.5" /> PNG
				</Button>

				<Button
					{disabled}
					variant="ghost"
					size="sm"
					class="h-8"
					title={disabled ? 'Please fill in all basic info to export' : 'Export as JPEG'}
					onclick={() => downloadImage('jpeg')}
				>
					<FileImage class="mr-2 h-3.5 w-3.5" /> JPEG
				</Button>

				<div class="mx-1 h-4 w-[1px] bg-zinc-300 dark:bg-zinc-700"></div>

				<Button
					{disabled}
					variant="default"
					size="sm"
					class="h-8"
					title={disabled ? 'Complete the form to generate PDF' : 'Download PDF Document'}
					onclick={downloadPDF}
				>
					<FileText class="mr-2 h-3.5 w-3.5" /> PDF
				</Button>
			</div>
		</div>
	</header>

	<div class="mx-auto grid max-w-305! grid-cols-1 gap-8 lg:grid-cols-12">
		<aside class="space-y-6 lg:col-span-4">
			<section
				class="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
			>
				<h3 class="text-xs font-bold tracking-widest text-zinc-400 uppercase">Basic Info</h3>
				<div class="grid gap-4">
					<div class="grid gap-1.5">
						<Label for="inv" class="text-[10px] font-bold uppercase">Invoice Number</Label>
						<Input
							id="inv"
							bind:value={invoiceNumber}
							placeholder="INV-001"
							class="bg-zinc-50 dark:bg-zinc-800"
						/>
					</div>
					<div class="grid gap-1.5">
						<Label class="text-[10px] font-bold uppercase">Billing Period</Label>
						<MonthYear bind:value={monthYear} />
					</div>
					<div class="grid gap-1.5">
						<Label class="text-[10px] font-bold uppercase">Authorizer</Label>
						<ComboboxComp items={data?.employees} name="employee" bind:value={employee} />
					</div>
				</div>
			</section>

			<section
				class="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
			>
				<h3 class="text-xs font-bold tracking-widest text-zinc-400 uppercase">Tax Settings</h3>
				<div class="grid grid-cols-2 gap-4">
					<div class="grid gap-1.5">
						<Label class="text-[10px] font-bold text-zinc-500 uppercase">VAT (%)</Label>
						<Input
							type="number"
							disabled
							bind:value={vatRate}
							class="bg-zinc-100 dark:bg-zinc-800/50"
						/>
					</div>
					<div class="grid gap-1.5">
						<Label class="text-[10px] font-bold text-zinc-500 uppercase">Withhold (%)</Label>
						<Input
							type="number"
							disabled
							bind:value={withholdRate}
							class="bg-zinc-100 dark:bg-zinc-800/50"
						/>
					</div>
				</div>
			</section>
		</aside>

		<main class="lg:col-span-8">
			<div class="sticky top-8 rounded-lg shadow-2xl transition-transform hover:scale-[1.01]">
				<div
					bind:this={elementRef}
					class="mx-auto min-h-210.5 w-full max-w-250 bg-white p-12 text-zinc-800 shadow-sm print:shadow-none"
					style="font-family: 'Inter', system-ui, sans-serif;"
				>
					<div class="mb-12 flex items-start justify-between">
						<div class="flex items-center gap-4">
							<div class="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-900">
								<img src="/logo.webp" class="h-10 w-10" alt="Logo" />
							</div>
							<div>
								<h2 class="text-2xl leading-none font-black tracking-tighter uppercase">
									Spotless
								</h2>
								<p class="text-[10px] font-medium tracking-widest text-zinc-500 uppercase">
									General Trading PLC
								</p>
							</div>
						</div>
						<div class="text-right">
							<div
								class="mb-2 inline-block bg-zinc-900 px-3 py-1 text-[10px] font-bold tracking-widest text-white uppercase"
							>
								Invoice
							</div>
							<p class="text-sm font-bold tracking-tight">{invoiceNumber || '---'}</p>
							<p class="text-[10px] font-medium text-zinc-400">
								{formatEthiopianDate(new Date(requestDate))}
							</p>
						</div>
					</div>

					<div class="mb-10 grid grid-cols-2 gap-12 border-y border-zinc-100 py-8">
						<div>
							<p class="mb-3 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
								Bill To
							</p>
							<p class="text-lg leading-tight font-bold">{customerName || '---'}</p>
							<p class="mt-1 text-xs text-zinc-600">{siteName || '---'}</p>
						</div>
						<div class="text-right">
							<p class="mb-3 text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
								Service
							</p>
							<p class="text-sm font-semibold">{data?.contracts?.serviceName || '---'}</p>
							<p class="mt-1 text-[11px] text-zinc-500 italic">{selectedMonth} {selectedYear}</p>
						</div>
					</div>

					<table class="mb-10 w-full">
						<thead>
							<tr
								class="border-b-2 border-zinc-900 text-left text-[10px] font-black tracking-widest uppercase"
							>
								<th class="pb-3">Description</th>
								<th class="pb-3 text-right">Amount</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-zinc-100 text-sm">
							<tr>
								<td class="py-5">
									<span class="font-bold">Monthly Service Fee</span>
									<p class="mt-1 text-[10px] text-zinc-400 uppercase">Standard contract rate</p>
								</td>
								<td class="py-5 text-right font-semibold">{fmt(Number(contractMonthlyAmount))}</td>
							</tr>
							{#if hasPenalty && penaltyAmount > 0}
								<tr class="text-rose-600">
									<td class="py-5 italic">
										Deduction: {penaltyReason || 'Penalty Applied'}
									</td>
									<td class="py-5 text-right font-bold">-{fmt(penaltyAmount)}</td>
								</tr>
							{/if}
						</tbody>
					</table>

					<div class="ml-auto w-72 space-y-3 rounded-xl bg-zinc-50 p-6">
						<div class="flex justify-between text-xs">
							<span class="text-zinc-500">Subtotal</span>
							<span class="font-bold">{fmt(requestAmount)}</span>
						</div>
						<div class="flex justify-between text-xs">
							<span class="text-zinc-500">VAT ({vatRate}%)</span>
							<span class="font-bold">{fmt(vat)}</span>
						</div>
						<div
							class="flex justify-between border-b border-zinc-200 pb-3 text-xs text-zinc-400 italic"
						>
							<span>Withholding ({withholdRate}%)</span>
							<span>-{fmt(withholdAmount)}</span>
						</div>
						<div class="flex items-center justify-between pt-1">
							<span class="text-[10px] font-bold tracking-wider uppercase">Total Due</span>
							<span class="text-xl font-black text-zinc-900">ETB {fmt(paymentAmount)}</span>
						</div>
					</div>

					<div class="mt-24 grid grid-cols-2 items-end">
						<div class="text-[10px] leading-relaxed text-zinc-400">
							<p class="mb-1 font-bold text-zinc-800 uppercase">Office Address</p>
							<p>Addis Ababa, Ethiopia</p>
							<p>Spotless General Trading PLC</p>
						</div>
						<div class="flex flex-col items-end">
							<div
								class="relative flex h-20 w-44 items-center justify-center border-b-2 border-zinc-100"
							>
								{#if data?.employees?.find((s) => s.value === employee)?.signiture}
									<img
										src="/dashboard/files/{data?.employees?.find((s) => s.value === employee)
											?.signiture}"
										alt="Signature"
										class="max-h-full mix-blend-multiply transition-opacity"
									/>
								{/if}
							</div>
							<p class="mt-3 text-[10px] font-black tracking-tight uppercase italic">
								{data?.employees?.find((s) => s.value === employee)?.name || 'Authorized Signatory'}
							</p>
						</div>
					</div>
				</div>
			</div>
		</main>
	</div>
</div>

<style>
	/* Specific target for the export tool to ensure a clean white background despite the dark mode UI */
	:global(.html-to-image-target) {
		background-color: white !important;
		color: #18181b !important; /* zinc-900 */
	}
</style>
