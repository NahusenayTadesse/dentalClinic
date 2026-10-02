<script lang="ts">
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import { MapPinIcon, MapIcon, LandmarkIcon, House, Building, Building2 } from '@lucide/svelte';

	interface Props {
		subcity?: string | null;
		street?: string | null;
		kebele?: string | null;
		buildingNumber?: string | number | null;
		floor?: string | number | null;
		houseNumber?: string | number | null;
	}

	const { subcity, street, kebele, buildingNumber, floor, houseNumber }: Props = $props();

	let concatenatedAddress = $derived(
		`${subcity ? `${subcity}, ` : ''}${street ? `${street}, ` : ''}${kebele ? `${kebele}, ` : ''}${buildingNumber ? `${buildingNumber}, ` : ''}${floor ? `${floor}, ` : ''}${houseNumber ? `${houseNumber}` : ''}`
	);
	let addressForMap = $derived(`${subcity ? `${subcity}, ` : ''}${street ? `${street}, ` : ''}`);

	function truncate(str: string | number | null | undefined, maxLength = 15) {
		// Ensure str exists and is treated as a string
		const safeStr = String(str || '');

		return safeStr.length > maxLength ? safeStr.slice(0, maxLength) + '...' : safeStr;
	}

	let mapSrc = $derived(
		`https://maps.google.com/maps?q=${encodeURIComponent(addressForMap)}&t=&z=13&ie=UTF8&iwloc=&output=embed`
	);

	/**
	 * The lines of the panel — only the fields that were actually given.
	 *
	 * The filtering used to live in a second `addressFields` array that the template never rendered,
	 * so an address with a subcity and a street still listed Kebele, Building, Floor and House
	 * Number with nothing under them. One list, and it is the one on screen.
	 */
	const addressFields = $derived(
		[
			{
				label: 'Subcity',
				value: subcity,
				icon: MapIcon
			},
			{
				label: 'Street',
				value: street,
				icon: LandmarkIcon
			},
			{
				label: 'Kebele',
				value: kebele,
				icon: House
			},
			{
				label: 'Building Number',
				value: buildingNumber,
				icon: Building
			},
			{
				label: 'Floor',
				value: floor,
				icon: Building2
			},
			{
				label: 'House Number or Office Number',
				value: houseNumber,
				icon: House
			}
		].filter((item) => item.value !== null && item.value !== undefined && item.value !== '')
	);

	const hasAddress = $derived(addressFields.length > 0);
</script>

<DialogComp
	title={truncate(concatenatedAddress)}
	description={concatenatedAddress}
	IconComp={MapPinIcon}
	variant="secondary"
>
	{#if hasAddress}
		<div class="space-y-3">
			<h4 class="text-sm font-semibold">Address Details</h4>
			<div class="flex flex-col gap-2">
				{#each addressFields as item, index (item.label)}
					<div class="relative flex items-start gap-3">
						<!-- Connecting line -->
						{#if index < addressFields.length - 1}
							<div class="absolute top-8 left-3.75 h-6 w-0.5 bg-border"></div>
						{/if}

						<!-- Icon -->
						<div class="shrink-0 rounded-md border bg-muted p-1.5 text-muted-foreground">
							<item.icon class="size-4" />
						</div>

						<!-- Content -->
						<div class="min-w-0 flex-1 py-0.5">
							<p class="text-xs font-medium text-muted-foreground">{item.label}</p>
							<p class="truncate text-sm font-medium">{item.value}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<iframe
			title="Google Map"
			width="100%"
			height="400"
			frameborder="0"
			scrolling="no"
			marginheight="0"
			marginwidth="0"
			src={mapSrc}
		></iframe>
	{:else}
		<div class="text-sm text-muted-foreground">No address information available</div>
	{/if}
</DialogComp>
