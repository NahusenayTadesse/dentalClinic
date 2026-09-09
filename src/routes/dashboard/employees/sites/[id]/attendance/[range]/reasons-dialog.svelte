<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	// import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Badge } from '$lib/components/ui/badge';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { BuildingIcon, BriefcaseIcon } from '@lucide/svelte';
	import AbsenceSummaryCards from './absence-summary.svelte';
	import AbsenceTable from './absence-table.svelte';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	interface StaffAbsence {
		id: number;
		name: string;
		department: string;
		status: string;
		absent: number;
		deductable: number;
		nonDeductable: number;
		allAbsentDays: string | null;
		deductableDays: string | null;
		nonDeductableDays: string | null;
		allReasons: string | null;
		daysWithReasons: string | null;
		deductableReasons: string | null;
		nonDeductableReasons: string | null;
	}

	interface AbsenceDetail {
		date: string;
		reason: string;
		isDeductable: boolean;
	}

	function parseAbsenceDetails(staff: StaffAbsence): AbsenceDetail[] {
		const details: AbsenceDetail[] = [];

		// Parse deductable days
		if (staff.deductableDays && staff.deductableReasons) {
			const days = staff.deductableDays.split(',').map((d) => d.trim());
			const reasons = staff.deductableReasons.split(',').map((r) => r.trim());
			days.forEach((day, index) => {
				if (day) {
					details.push({
						date: day,
						reason: reasons[index] || 'No reason provided',
						isDeductable: true
					});
				}
			});
		}

		// Parse non-deductable days
		if (staff.nonDeductableDays && staff.nonDeductableReasons) {
			const days = staff.nonDeductableDays.split(',').map((d) => d.trim());
			const reasons = staff.nonDeductableReasons.split(',').map((r) => r.trim());
			days.forEach((day, index) => {
				if (day) {
					details.push({
						date: day,
						reason: reasons[index] || 'No reason provided',
						isDeductable: false
					});
				}
			});
		}

		// Sort by date descending
		return details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	}

	interface Props {
		staff: StaffAbsence | null;
	}

	let { staff }: Props = $props();

	let value = $state('all');

	let allAbsences: AbsenceDetail[] = $derived(staff ? parseAbsenceDetails(staff) : []);
	let deductableAbsences: AbsenceDetail[] = $derived(allAbsences.filter((a) => a.isDeductable));
	let nonDeductableAbsences: AbsenceDetail[] = $derived(allAbsences.filter((a) => !a.isDeductable));

	let className =
		'shadow-md shadow-primary/20 bg-primary text-white dark:text-black font-medium rounded-lg px-4 py-2 transition-all duration-200 transform scale-105 ring-2 ring-primary ring-offset-2';
</script>

<DialogComp title="Absence Details" variant="ghost" class="max-w-2xl">
	{#snippet trigger(props)}
		<Button size="sm" variant="ghost" class="border-0" {...props}>View Absence Details</Button>
	{/snippet}
	{#snippet header()}
		{#if staff}
			<Dialog.Header>
				<Dialog.Title class="flex items-center gap-3 text-xl">
					<div
						class="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
					>
						{staff.name.charAt(0).toUpperCase()}
					</div>
					{staff.name}
				</Dialog.Title>
				<Dialog.Description class="flex flex-wrap items-center gap-3 pt-2">
					<span class="flex items-center gap-1.5">
						<BuildingIcon class="size-4" />
						{staff.department}
					</span>
					<Separator orientation="vertical" class="h-4" />
					<span class="flex items-center gap-1.5">
						<BriefcaseIcon class="size-4" />
						<Badge variant="secondary">{staff.status}</Badge>
					</span>
				</Dialog.Description>
			</Dialog.Header>
		{/if}
	{/snippet}
	{#if staff}
		<div class="mt-4 flex flex-col gap-4">
			<AbsenceSummaryCards
				total={staff.absent}
				deductable={staff.deductable}
				nonDeductable={staff.nonDeductable}
			/>

			<Tabs.Root bind:value class="w-full">
				<Tabs.List class="grid w-full grid-cols-3">
					<Tabs.Trigger value="all" class={value === 'all' ? className : ''}>
						All
						<Badge variant="secondary" class="ml-1.5 px-1.5 py-0 text-xs"
							>{allAbsences.length}</Badge
						>
					</Tabs.Trigger>
					<Tabs.Trigger value="deductable" class={value === 'deductable' ? className : ''}>
						Deductable
						<Badge variant="destructive" class="ml-1.5 px-1.5 py-0 text-xs"
							>{deductableAbsences.length}</Badge
						>
					</Tabs.Trigger>
					<Tabs.Trigger value="excused" class={value === 'excused' ? className : ''}>
						Non Deductable
						<Badge
							class="ml-1.5 bg-emerald-500/20 px-1.5 py-0 text-xs text-emerald-700 dark:text-emerald-400"
							>{nonDeductableAbsences.length}</Badge
						>
					</Tabs.Trigger>
				</Tabs.List>

				<ScrollArea class="mt-4 h-75 rounded-md border">
					<Tabs.Content value="all" class="m-0">
						<AbsenceTable absences={allAbsences} showStatus={true} />
					</Tabs.Content>
					<Tabs.Content value="deductable" class="m-0">
						<AbsenceTable absences={deductableAbsences} showStatus={false} />
					</Tabs.Content>
					<Tabs.Content value="excused" class="m-0">
						<AbsenceTable absences={nonDeductableAbsences} showStatus={false} />
					</Tabs.Content>
				</ScrollArea>
			</Tabs.Root>
		</div>
	{/if}
</DialogComp>
