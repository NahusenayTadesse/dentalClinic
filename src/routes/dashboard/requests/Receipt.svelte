<script lang="ts">
	/**
	 * The invoice document, in one place.
	 *
	 * Pending, approved, cancelled and the special-request preview all printed
	 * their own copy of this markup, so a fix to one silently left the other
	 * three behind — the approved page had a bordered totals table and a third
	 * signature column that neither of the others ever grew.
	 *
	 * Two things drive the layout:
	 *
	 *  - `months` may hold more than one period. A special request bills several
	 *    months on a single invoice, so the table gains a Month column and the
	 *    totals multiply by the number of months billed.
	 *  - It has to survive a laser printer. Everything is near-black on white:
	 *    the zinc-100/200/400 hairlines and washed grey type this used to carry
	 *    disappeared on paper, which is where this document actually lives.
	 */
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte.js';
	import { COMPANY_PHONE } from './receipts';

	/** `officeEmployees()` rows — the `Item` shape plus the signature image. */
	type Signatory = { value: string | number; name: string; signiture?: string | null };

	/** Loose on purpose: the four pages that render this select different columns. */
	type Contract = {
		id: number;
		siteId: number | null;
		serviceName?: string | null;
		monthlyAmount?: string | number | null;
	};

	let {
		invoiceNumber,
		siteId,
		siteName,
		customerName,
		requestDate,
		months,
		contracts,
		vat,
		withhold,
		employees = [],
		requestedBy = null,
		approvedBy = null,
		/**
		 * The line the customer signs on receipt. Only the approved page shows it,
		 * because that is the copy that goes out on paper to be signed.
		 */
		showClientSignature = false,
		exportName = undefined
	}: {
		invoiceNumber: string;
		siteId: number;
		siteName?: string | null;
		customerName?: string | null;
		requestDate: Date | string;
		months: { month: string; year: number }[];
		contracts: Contract[];
		vat: number | string;
		withhold: number | string;
		employees?: Signatory[];
		requestedBy?: number | null;
		approvedBy?: number | null;
		showClientSignature?: boolean;
		exportName?: string;
	} = $props();

	const siteContracts = $derived(contracts.filter((c) => c.siteId === siteId));
	const monthCount = $derived(Math.max(months.length, 1));

	const vatRate = $derived(Number(vat) || 0);
	const withholdRate = $derived(Number(withhold) || 0);

	const totals = $derived.by(() => {
		const monthly = siteContracts.reduce((sum, c) => sum + (Number(c.monthlyAmount) || 0), 0);
		const subtotal = monthly * monthCount;

		// The stored monthly amount is VAT-inclusive, so VAT is backed out of it
		// rather than added on, and withholding is taken on the pre-VAT figure.
		const beforeVat = subtotal / (1 + vatRate / 100);
		const vatAmount = subtotal - beforeVat;
		const withholdAmount = beforeVat * (withholdRate / 100);

		return { subtotal, vatAmount, withholdAmount, finalPayable: subtotal - withholdAmount };
	});

	const fmt = (n: number) =>
		n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	const employeeOf = (id: number | null) => employees.find((e) => e.value === id);

	/** "ሰኔ፣ ሐምሌ፣ ነሐሴ" — the Amharic list separator, not a comma. */
	const monthList = $derived(months.map((m) => m.month).join('፣ '));
	/** One year on the line when the invoice sits inside a single year. */
	const yearList = $derived([...new Set(months.map((m) => m.year))].join('፣ '));
</script>

{#snippet signature(label: string, name: string | undefined, file: string | null | undefined)}
	<div class="flex flex-col items-center">
		<div class="relative flex h-24 w-full items-end justify-center border-b-2 border-black">
			{#if file}
				<img src="/dashboard/files/{file}" class="max-h-full mix-blend-multiply" alt="signature" />
			{/if}
		</div>
		<p class="mt-3 text-xs font-black tracking-wide text-black uppercase">{label}</p>
		<p class="text-xs font-semibold text-zinc-700">{name || '—'}</p>
	</div>
{/snippet}

<section
	class="invoice-page relative w-full max-w-212.5 bg-white p-16 text-black shadow-2xl"
	data-sitename={exportName}
>
	<!-- Header -->
	<div class="mb-10 flex items-start justify-between">
		<div class="flex items-center gap-4">
			<div class="flex h-18 w-18 items-center justify-center rounded-xl bg-black">
				<img src="/logo.webp" class="h-16 w-16" alt="Logo" />
			</div>
			<div>
				<h2 class="text-2xl font-black tracking-tighter text-black uppercase">Spotless</h2>
				<p class="text-[10px] font-bold tracking-widest text-zinc-700 uppercase">
					General Trading PLC
				</p>
				<p class="mt-1 text-xs font-bold text-black">Tel: {COMPANY_PHONE}</p>
			</div>
		</div>
		<div class="text-right">
			<div
				class="mb-2 inline-block bg-black px-3 py-1 text-[10px] font-black tracking-widest text-white uppercase"
			>
				Invoice
			</div>
			<p class="text-sm font-black">{invoiceNumber}</p>
			<p class="text-xs font-semibold text-zinc-700">
				{formatEthiopianDate(new Date(requestDate))}
			</p>
		</div>
	</div>

	<!-- Client Info -->
	<div class="mb-8 grid grid-cols-1 gap-8 border-y-2 border-black py-6">
		<div class="flex flex-col gap-2">
			<div class="flex items-baseline gap-2">
				<p class="text-[11px] font-black text-zinc-700 uppercase">To:</p>
				<p class="text-lg font-extrabold text-black underline">{customerName || '—'}</p>
			</div>
			<div class="flex items-baseline gap-2">
				<p class="text-[11px] font-black text-zinc-700 uppercase">Site:</p>
				<p class="text-lg font-extrabold text-black underline">{siteName || '—'}</p>
			</div>
		</div>
		<div>
			<p class="text-sm font-semibold text-black">
				ድርጅታችን ለድርጅታቹ ከታች የተደረደሩትን {siteContracts.length === 1 ? 'አገልግሎት' : 'አገልግሎቶች'} እየሰጠ መሆኑ ይታወቃል።
				በዚሁ መሰረት የ
				<span class="font-black underline">{monthList}</span>
				{monthCount === 1 ? 'ወር' : 'ወራት'}
				<span class="font-black underline">{yearList}</span>
				ወርሃዊ ክፍያ እንደሚከተለው እንጠይቃለን፡፡
			</p>
		</div>
	</div>

	<!-- Items Table -->
	<table class="mb-8 w-full border-collapse border-2 border-black">
		<thead>
			<tr class="border-b-2 border-black bg-zinc-100 text-left text-[11px] font-black uppercase">
				<th class="border border-black px-2 py-2">Service Description</th>
				{#if monthCount > 1}
					<th class="border border-black px-2 py-2">Month</th>
				{/if}
				<th class="border border-black px-2 py-2 text-right">Rate (ETB)</th>
			</tr>
		</thead>
		<tbody class="text-sm font-semibold">
			{#each months as period (period.month + period.year)}
				{#each siteContracts as contract (contract.id)}
					<tr>
						<td class="border border-black px-2 py-4 font-bold">
							{contract.serviceName || 'Maintenance Service'}
						</td>
						{#if monthCount > 1}
							<td class="border border-black px-2 py-4 font-bold">
								{period.month}
								{period.year}
							</td>
						{/if}
						<td class="border border-black px-2 py-4 text-right font-bold">
							{formatETB(Number(contract.monthlyAmount), true)}
						</td>
					</tr>
				{/each}
			{/each}
		</tbody>
	</table>

	<!-- Totals -->
	<div class="ml-auto w-80 text-xs text-black">
		<table class="w-full border-collapse border-2 border-black">
			<tbody>
				<tr>
					<td class="border border-black p-2 text-left font-bold">
						ድምር (TOTAL{monthCount > 1 ? ` × ${monthCount} months` : ''})
					</td>
					<td class="border border-black p-2 text-right font-bold">
						{formatETB(totals.subtotal, true)}
					</td>
				</tr>
				<tr>
					<td class="border border-black p-2 text-left font-semibold">
						ተ.እ.ታ VAT ({fmt(vatRate)}%)
					</td>
					<td class="border border-black p-2 text-right font-semibold">
						-{formatETB(totals.vatAmount, true)}
					</td>
				</tr>
				<tr>
					<td class="border border-black p-2 text-left font-semibold">
						ተከፋይ ሂሳብ የተቀነሰ ግብር Withholding ({fmt(withholdRate)}%)
					</td>
					<td class="border border-black p-2 text-right font-semibold">
						-{formatETB(totals.withholdAmount, true)}
					</td>
				</tr>
				<tr class="border-t-4 border-double border-black bg-zinc-100">
					<td class="border border-black p-2.5 text-left font-black tracking-wider uppercase">
						Total Payable
					</td>
					<td class="border border-black p-2.5 text-right text-lg font-black">
						{formatETB(totals.finalPayable, true)}
					</td>
				</tr>
			</tbody>
		</table>
	</div>

	<!-- Signatures -->
	<div class="mt-16 grid grid-cols-2 gap-16">
		{@render signature(
			'Requested By',
			employeeOf(requestedBy)?.name,
			employeeOf(requestedBy)?.signiture
		)}
		{@render signature(
			'Authorized By',
			employeeOf(approvedBy)?.name,
			employeeOf(approvedBy)?.signiture
		)}
	</div>

	{#if showClientSignature}
		<!--
			The customer signs this copy by hand, so it gets a box of its own rather
			than a third thin column: name, signature and date all have somewhere to
			go, and the frame survives a photocopy.
		-->
		<div class="mt-10 border-4 border-black p-6">
			<p class="mb-5 text-center text-sm font-black tracking-widest text-black uppercase">
				Received By / ተረካቢ
			</p>
			<div class="grid grid-cols-3 gap-8">
				<div>
					<div class="h-14 border-b-2 border-black"></div>
					<p class="mt-2 text-center text-[11px] font-black uppercase">Name / ስም</p>
				</div>
				<div>
					<div class="h-14 border-b-2 border-black"></div>
					<p class="mt-2 text-center text-[11px] font-black uppercase">Signature / ፊርማ</p>
				</div>
				<div>
					<div class="h-14 border-b-2 border-black"></div>
					<p class="mt-2 text-center text-[11px] font-black uppercase">Date / ቀን</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Footer -->
	<div class="mt-12 text-center text-[10px] font-bold tracking-widest text-zinc-700 uppercase">
		Spotless General Trading PLC • Addis Ababa, Ethiopia • Tel: {COMPANY_PHONE} • Thank you for your business
	</div>
</section>

<style>
	.invoice-page {
		font-family: 'Inter', system-ui, sans-serif;
		line-height: 1.5;
		/* The black header block and the shaded total row are the anchors the eye
		   uses on paper; without this the browser drops them from the print job. */
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}

	@media print {
		.invoice-page {
			box-shadow: none !important;
			margin: 0 !important;
			break-inside: avoid;
		}
	}
</style>
