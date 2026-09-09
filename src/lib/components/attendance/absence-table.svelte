<script lang="ts">
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { CalendarIcon, MessageSquareIcon } from '@lucide/svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	interface AbsenceDetail {
		date: string;
		reason: string;
		isDeductable: boolean;
	}

	interface Props {
		absences: AbsenceDetail[];
		showStatus?: boolean;
	}

	let { absences, showStatus = true }: Props = $props();

	/** Format date to readable string */
	function formatDate(dateStr: string): string {
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString('am-ET', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				calendar: 'ethiopic'
			});
		} catch {
			return dateStr;
		}
	}
</script>

{#if absences.length === 0}
	<div class="flex flex-col items-center justify-center py-12 text-center">
		<CalendarIcon class="mb-3 size-12 text-muted-foreground/50" />
		<p class="text-muted-foreground">No absences recorded</p>
	</div>
{:else}
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead class="w-45">Date</TableHead>
				<TableHead>Reason</TableHead>
				{#if showStatus}
					<TableHead class="w-30 text-right">Status</TableHead>
				{/if}
			</TableRow>
		</TableHeader>
		<TableBody>
			{#each absences as absence (absence.date + absence.reason)}
				<TableRow>
					<TableCell class="font-medium">
						<div class="flex items-center gap-2">
							<CalendarIcon class="size-4 text-muted-foreground" />
							{formatEthiopianDate(new Date(absence.date))}
						</div>
					</TableCell>
					<TableCell>
						<div class="flex items-center gap-2">
							<MessageSquareIcon class="size-4 shrink-0 text-muted-foreground" />
							<span class="line-clamp-2">{absence.reason}</span>
						</div>
					</TableCell>
					{#if showStatus}
						<TableCell class="text-right">
							{#if absence.isDeductable}
								<Badge variant="destructive" class="text-xs">Deductable</Badge>
							{:else}
								<Badge
									class="bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 dark:text-emerald-400"
									>Non Deductable</Badge
								>
							{/if}
						</TableCell>
					{/if}
				</TableRow>
			{/each}
		</TableBody>
	</Table>
{/if}
