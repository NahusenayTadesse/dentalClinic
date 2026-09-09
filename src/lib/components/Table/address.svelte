<script lang="ts">
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import {
		MapPinIcon,
		FlagIcon,
		BuildingIcon,
		MapIcon,
		LandmarkIcon,
		House,
		Building,
		Building2
	} from '@lucide/svelte';

	type Address = {
		subcity?: string | null;
		street?: string | null;
		kebele?: string | null;
		buildingNumber?: string | null;
		floor?: string | null;
		houseNumber?: string | null;
	};

	interface Props {
		subcity?: string | null;
		street?: string | null;
		kebele?: string | null;
		buildingNumber?: string | null;
		floor?: string | null;
		houseNumber?: string | null;
	}

	const { subcity, street, kebele, buildingNumber, floor, houseNumber }: Props = $props();

	let concatenatedAddress = $derived(
		`${subcity ? `${subcity}, ` : ''}${street ? `${street}, ` : ''}${kebele ? `${kebele}, ` : ''}${buildingNumber ? `${buildingNumber}, ` : ''}${floor ? `${floor}, ` : ''}${houseNumber ? `${houseNumber}` : ''}`
	);
	let addressForMap = $derived(`${subcity ? `${subcity}, ` : ''}${street ? `${street}, ` : ''}`);

	// Filter out empty address fields
	const addressFields = $derived.by(() => {
		const fields: { label: string; value: string }[] = [];
		if (subcity) fields.push({ label: 'Subcity', value: subcity });
		if (street) fields.push({ label: 'Street', value: street });
		if (kebele) fields.push({ label: 'Kebele', value: kebele });
		if (buildingNumber) fields.push({ label: 'Building', value: buildingNumber });
		if (floor) fields.push({ label: 'Floor', value: floor });
		if (houseNumber) fields.push({ label: 'House Number', value: houseNumber });
		return fields;
	});

	const hasAddress = $derived(addressFields.length > 0);
	let open = $state(false);

	function truncate(str, maxLength = 15) {
		// Ensure str exists and is treated as a string
		const safeStr = String(str || '');

		return safeStr.length > maxLength ? safeStr.slice(0, maxLength) + '...' : safeStr;
	}

	let mapSrc = $derived(
		`https://maps.google.com/maps?q=${encodeURIComponent(addressForMap)}&t=&z=13&ie=UTF8&iwloc=&output=embed`
	);

	const hierarchyItems = $derived([
		{
			label: 'Subcity',
			value: subcity,
			icon: MapIcon,
			color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
		},
		{
			label: 'Street',
			value: street,
			icon: LandmarkIcon,
			color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
		},
		{
			label: 'Kebele',
			value: kebele,
			icon: House,
			color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
		},
		{
			label: 'Building Number',
			value: buildingNumber,
			icon: Building,
			color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
		},
		{
			label: 'Floor',
			value: floor,
			icon: Building2,
			color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
		},
		{
			label: 'House Number or Office Number',
			value: houseNumber,
			icon: House,
			color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
		}
	]);
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
				{#each hierarchyItems as item, index (item.label)}
					<div class="relative flex items-start gap-3">
						<!-- Connecting line -->
						{#if index < hierarchyItems.length - 1}
							<div class="absolute top-8 left-3.75 h-6 w-0.5 bg-border"></div>
						{/if}

						<!-- Icon -->
						<div class={['shrink-0 rounded-md border p-1.5', item.color]}>
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
