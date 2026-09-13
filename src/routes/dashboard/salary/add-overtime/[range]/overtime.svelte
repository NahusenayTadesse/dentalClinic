<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';
	import { formatETB, formatEthiopianDate, type Item } from '$lib/global.svelte';
	import { Clock, CalendarDays, MessageSquare, Pen } from '@lucide/svelte';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { page } from '$app/state';
	import DeleteForm from './delete.svelte';
	import EditForm from './edit.svelte';
	import AddForm from './add.svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';

	import type { SuperValidated } from 'sveltekit-superforms';

	interface OvertimeEntry {
		id: number;
		date: string;
		overtimeType: string;
		hours: number;
		total: number;
		reason: string;
	}
	import type { Add, Delete, Edit } from './schema';
	import { fade } from 'svelte/transition';
	let {
		data,
		editForm,
		addForm,
		overtimeDetails,
		name,
		staffId,
		department,
		position,
		branch,
		totalOvertimePay,
		overtimeTypes,
		canDelete = false
	}: {
		data: SuperValidated<Delete>;
		editForm: SuperValidated<Edit>;
		addForm: SuperValidated<Add>;
		overtimeDetails: OvertimeEntry[];
		staffId: number;
		name: string;
		department: string;
		position: string;
		branch: string;
		totalOvertimePay: number;
		overtimeTypes: Item[];
		/** Only a super admin gets the per-row delete button. */
		canDelete?: boolean;
	} = $props();

	const getDistinctTypes = $derived(() => {
		return [...new Set(overtimeDetails.map((item) => item.overtimeType))];
	});

	const getTotalByType = (type: string) => {
		return overtimeDetails
			.filter((entry) => entry.overtimeType === type)
			.reduce((sum, entry) => sum + Number(entry.total), 0);
	};

	const filterByType = (type: string) => {
		return overtimeDetails.filter((entry) => entry.overtimeType === type);
	};

	// const grandTotal = $derived(overtimeDetails.reduce((sum, entry) => sum + entry.total, 0));
	const grandTotal = $derived(totalOvertimePay);

	// Set initial tab value to first type
	let selectedTab = $derived('All');
</script>

<DialogComp title={name} variant="ghost" class="sm:max-w-125">
	{#snippet trigger(props)}
		<button {...props} class="font-semibold text-primary transition-all hover:underline">
			{formatETB(grandTotal, true)}
		</button>
	{/snippet}
	{#snippet header()}
		<div class="flex items-start gap-4 pb-2">
			<div
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"
			>
				<Clock class="h-5 w-5 text-primary" />
			</div>
			<div class="min-w-0 flex-1 space-y-2">
				<p class="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
					Overtime Request
				</p>
				<Dialog.Title class="text-xl leading-tight font-semibold tracking-tight"
					>{name}</Dialog.Title
				>
				<Dialog.Description>
					<div class="flex flex-wrap items-center gap-1.5">
						<Badge variant="secondary" class="rounded-md px-2 py-0.5 text-xs font-medium"
							>{position}</Badge
						>
						<span class="text-muted-foreground/40">·</span>
						<span class="text-xs text-muted-foreground">{department}</span>
						<span class="text-muted-foreground/40">·</span>
						<span class="text-xs text-muted-foreground">{branch}</span>
					</div>
				</Dialog.Description>
				<div class="justify-self-end">
					<AddForm {overtimeTypes} data={addForm} {staffId} />
				</div>
			</div>
		</div>
	{/snippet}

	<Separator />

	<!-- Fixed Tabs Implementation -->
	<Tabs.Root bind:value={selectedTab}>
		<Tabs.List class="w-full">
			<Tabs.Trigger
				value="All"
				class="flex-1 transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
				>All</Tabs.Trigger
			>
			{#each getDistinctTypes() as type}
				<Tabs.Trigger
					value={type}
					class="flex-1 transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
					>{type}</Tabs.Trigger
				>
			{/each}
		</Tabs.List>

		<Tabs.Content value="All" class="mt-4 space-y-4">
			<!-- Type Total Header -->

			<div class="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
				<span class="text-sm font-medium text-muted-foreground"
					>All Total({overtimeDetails.length})
				</span>

				<span class="text-lg font-bold text-primary">{formatETB(grandTotal, true)}</span>
			</div>

			<!-- Filtered Details for this Type -->
			<ScrollArea class="h-72 pr-4">
				<div class="space-y-3">
					{#each overtimeDetails as entry (entry.id)}
						<div
							class="rounded-xl border bg-card text-card-foreground shadow-xs transition-colors hover:bg-muted/30"
							transition:fade
						>
							<div class="flex items-center justify-between px-4 py-3">
								<div class="flex items-center gap-3">
									<div
										class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary"
									>
										<CalendarDays class="h-4 w-4" />
									</div>
									<div class="space-y-1">
										<p class="text-sm leading-none font-semibold">
											{formatEthiopianDate(new Date(entry.date))}
										</p>
										<Badge
											variant="secondary"
											class="rounded-sm px-1.5 py-0 text-[10px] tracking-wider uppercase"
										>
											{entry.overtimeType}
										</Badge>
									</div>
								</div>
								<div class="text-right">
									<p class="text-sm font-bold tabular-nums">{formatETB(entry.total, true)}</p>
									<p class="mt-0.5 text-xs text-muted-foreground">{entry.hours} hrs</p>
								</div>
							</div>

							{#if entry.reason}
								<div class="flex items-start gap-2 rounded-b-xl border-t bg-muted/30 px-4 py-2.5">
									<MessageSquare class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
									<p class="text-xs leading-relaxed text-muted-foreground">
										<span class="font-medium text-foreground">Reason: </span>{entry.reason}
									</p>
								</div>
							{/if}
							<div class="flex flex-row flex-wrap gap-2 pb-4 pl-2">
								<EditForm {overtimeTypes} data={editForm} {staffId} overTimeDetails={entry} />
								<DeleteForm {data} id={entry.id} {canDelete} />
							</div>
						</div>
					{/each}
				</div>
			</ScrollArea>
		</Tabs.Content>

		{#each getDistinctTypes() as type}
			<Tabs.Content value={type} class="mt-4 space-y-4">
				<!-- Type Total Header -->
				<div class="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
					<span class="text-sm font-medium text-muted-foreground"
						>{type} Total({filterByType(type).length})</span
					>
					<span class="text-lg font-bold text-primary">{formatETB(getTotalByType(type), true)}</span
					>
				</div>

				<!-- Filtered Details for this Type -->
				<ScrollArea class="h-72 pr-4">
					<div class="space-y-3">
						{#each filterByType(type) as entry (entry.id)}
							<div
								class="rounded-xl border bg-card text-card-foreground shadow-xs transition-colors hover:bg-muted/30"
								transition:fade
							>
								<div class="flex items-center justify-between px-4 py-3">
									<div class="flex items-center gap-3">
										<div
											class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary"
										>
											<CalendarDays class="h-4 w-4" />
										</div>
										<div class="space-y-1">
											<p class="text-sm leading-none font-semibold">
												{formatEthiopianDate(new Date(entry.date))}
											</p>
											<Badge
												variant="secondary"
												class="rounded-sm px-1.5 py-0 text-[10px] tracking-wider uppercase"
											>
												{entry.overtimeType}
											</Badge>
										</div>
									</div>
									<div class="text-right">
										<p class="text-sm font-bold tabular-nums">{formatETB(entry.total, true)}</p>
										<p class="mt-0.5 text-xs text-muted-foreground">{entry.hours} hrs</p>
									</div>
								</div>

								{#if entry.reason}
									<div class="flex items-start gap-2 rounded-b-xl border-t bg-muted/30 px-4 py-2.5">
										<MessageSquare class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
										<p class="text-xs leading-relaxed text-muted-foreground">
											<span class="font-medium text-foreground">Reason: </span>{entry.reason}
										</p>
									</div>
								{/if}
								<div class="flex flex-row flex-wrap gap-2 pb-4 pl-2">
									<EditForm {overtimeTypes} {staffId} data={editForm} overTimeDetails={entry} />
									<DeleteForm {data} id={entry.id} {canDelete} />
								</div>
							</div>
						{/each}
					</div>
				</ScrollArea>
			</Tabs.Content>
		{/each}
	</Tabs.Root>

	<Separator class="my-4" />

	<div class="flex items-center justify-between px-2">
		<span class="text-sm font-medium">Grand Total</span>
		<span class="text-lg font-bold text-primary">{formatETB(grandTotal, true)}</span>
	</div>
</DialogComp>
