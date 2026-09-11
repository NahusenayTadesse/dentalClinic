<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Download } from '@lucide/svelte';
	import { fileUrl } from '$lib/global.svelte';

	let { staff } = $props();

	// Create a reference variable for the DOM element
	let cardElement: HTMLElement | null = $state(null);

	const downloadId = async (format: 'pdf' | 'png') => {
		// Guard clause if the element hasn't mounted yet
		if (!cardElement) return;

		try {
			const { toPng } = await import('html-to-image');
			const { default: jsPDF } = await import('jspdf');

			const fileName = `${staff?.firstName || 'Staff'}_${staff?.lastName || 'ID'}`;

			// Pass the actual DOM node directly to toPng
			const dataUrl = await toPng(cardElement, {
				pixelRatio: 2,
				backgroundColor: '#ffffff',
				style: {
					transform: 'scale(1)' // Clears up potential scaling artifacts during capture
				}
			});

			if (format === 'png') {
				const link = document.createElement('a');
				link.download = `${fileName}.png`;
				link.href = dataUrl;
				link.click();
				link.remove();
			} else {
				const pdf = new jsPDF('p', 'mm', 'a4');
				const imgProps = pdf.getImageProperties(dataUrl);
				const pdfWidth = pdf.internal.pageSize.getWidth();
				const pdfHeight = (imgProps.height * pdfWidth * 0.85) / imgProps.width;

				pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
				pdf.save(`${fileName}.pdf`);
			}
		} catch (err) {
			console.error(`Export failed:`, err);
		}
	};
</script>

<div class="flex flex-col items-center gap-6 p-8">
	<div bind:this={cardElement} class="inline-block">
		<div class="id-card">
			<!-- Top header bar -->
			<div class="id-top bg-foreground dark:bg-background">
				<div class="id-top-inner">
					<div class="id-org">
						<span class="id-org-name">Spotless</span>
						<span class="id-org-sub">Employee Identification</span>
					</div>
					<div class="id-logo">
						<img src="/logo.webp" alt="Logo" />
					</div>
				</div>
				<div class="id-top-arc"></div>
			</div>

			<!-- Photo + name section -->
			<div class="id-photo-area">
				<div class="id-photo-ring">
					<img src={staff?.photo ? fileUrl(staff.photo) : fileUrl('default.jpg')} alt="Profile" />
				</div>
				<div class="id-name">
					{staff?.firstName}
					{staff?.fatherName}
					{staff?.grandFatherName}
				</div>
				<div class="id-badge" class:inactive={!staff?.isActive}>
					<span class="id-dot" class:inactive={!staff?.isActive}></span>
					{staff?.status || 'Unknown'}
				</div>
			</div>

			<div class="id-divider"></div>

			<!-- Fields grid -->
			<div class="id-fields">
				<div class="id-field">
					<span class="id-field-label">Department</span>
					<span class="id-field-value">{staff?.department}</span>
				</div>
				<div class="id-field">
					<span class="id-field-label">Position</span>
					<span class="id-field-value">{staff?.position}</span>
				</div>
				<div class="id-field">
					<span class="id-field-label">Branch</span>
					<span class="id-field-value">{staff?.branch}</span>
				</div>
				<div class="id-field">
					<span class="id-field-label">Blood Type</span>
					<span class="id-field-value">{staff?.bloodType || 'N/A'}</span>
				</div>
				<div class="id-field full">
					<span class="id-field-label">ID Number</span>
					<span class="id-field-value">{staff?.idNo}</span>
				</div>
				<div class="id-field full">
					<span class="id-field-label">TIN Number</span>
					<span class="id-field-value mono">{staff?.tinNo}</span>
				</div>
			</div>

			<!-- Footer strip -->
			<div class="id-strip bg-foreground dark:bg-background">
				<div>
					<span class="id-strip-brand">Spotless.</span>
					<span class="id-strip-id">ID Card</span>
				</div>
				<div class="id-barcode text-white" aria-hidden="true">
					{#each [100, 65, 80, 45, 100, 55, 70, 100, 60, 85, 50, 100, 65, 40, 90] as h}
						<span style="height:{h}% text-white bg-white"></span>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

<div class="no-print flex justify-center gap-4">
	<Button onclick={() => downloadId('pdf')}>
		<Download class="mr-2 h-4 w-4" /> Download in PDF
	</Button>
	<Button onclick={() => downloadId('png')}>
		<Download class="mr-2 h-4 w-4" /> Download in PNG
	</Button>
</div>

<style>
	.id-card {
		width: 320px;

		overflow: hidden;
		box-shadow:
			0 2px 0 0 #18184a,
			0 4px 24px rgba(24, 24, 74, 0.13);
		font-family: 'DM Sans', sans-serif;
		background: #fff;
		border: 1px solid #e2e2f0;
		print-color-adjust: exact;
	}

	/* ── Header ── */
	.id-top {
		position: relative;
		overflow: hidden;
	}
	.id-top-inner {
		padding: 22px 24px 44px;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		position: relative;
		z-index: 1;
	}
	.id-top-arc {
		background: #fff;
		border-radius: 0 0 50% 50% / 0 0 28px 28px;
		position: absolute;
		bottom: -1px;
		left: -10%;
		width: 120%;
		height: 36px;
	}
	.id-org {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.id-org-name {
		font-family: 'Playfair Display', serif;
		font-size: 15px;
		font-weight: 600;
		color: #fff;
	}
	.id-org-sub {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.55);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.id-logo {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.12);
		border: 1.5px solid rgba(255, 255, 255, 0.25);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.id-logo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* ── Photo ── */
	.id-photo-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: -8px;
		padding: 0 0 20px;
	}
	.id-photo-ring {
		width: 96px;
		height: 96px;
		border-radius: 50%;
		border: 3px solid #18184a;
		overflow: hidden;
		background: #e9e9f5;
		box-shadow: 0 2px 12px rgba(24, 24, 74, 0.15);
	}
	.id-photo-ring img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.id-name {
		margin-top: 12px;
		text-align: center;
		font-family: 'Playfair Display', serif;
		font-size: 17px;
		font-weight: 600;
		line-height: 1.25;
		padding: 0 16px;
		text-transform: capitalize;
	}
	.id-badge {
		margin-top: 6px;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		background: #eeeefa;
		border-radius: 20px;
		padding: 3px 12px;
		font-size: 11px;
		font-weight: 600;
	}
	.id-badge.inactive {
		background: #fee2e2;
		color: #991b1b;
	}
	.id-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #22c55e;
	}
	.id-dot.inactive {
		background: #ef4444;
	}

	/* ── Fields ── */
	.id-divider {
		margin: 0 20px 0;
		height: 1px;
		background: #e2e2f0;
	}
	.id-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		padding: 16px 20px;
	}
	.id-field {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.id-field.full {
		grid-column: 1 / -1;
	}
	.id-field-label {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #9898b8;
	}
	.id-field-value {
		font-size: 13px;
		font-weight: 500;
	}
	.id-field-value.mono {
		font-family: monospace;
		font-size: 12px;
	}

	/* ── Footer ── */
	.id-strip {
		padding: 10px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.id-strip-brand {
		font-family: 'Playfair Display', serif;
		font-size: 13px;
		font-weight: 600;
		color: #fff;
		display: block;
	}
	.id-strip-id {
		font-size: 10px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.5);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		display: block;
	}
	.id-barcode {
		display: flex;
		gap: 1.5px;
		align-items: flex-end;
		height: 20px;
		color: white;
	}
	.id-barcode span {
		border-radius: 1px;
		display: block;
		width: 2px;
	}

	@media print {
		.id-card {
			box-shadow: none;
		}
	}
</style>
