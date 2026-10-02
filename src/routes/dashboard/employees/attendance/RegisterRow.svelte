<script lang="ts">
	import type { SuperValidated } from 'sveltekit-superforms';
	import LogIn from '@lucide/svelte/icons/log-in';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Undo from '@lucide/svelte/icons/undo-2';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import StepButton from '$lib/formComponents/StepButton.svelte';
	import { DAY_LABEL, hoursAndMinutes, type DayStatus } from '$lib/attendance';
	import DayBadge from './DayBadge.svelte';

	/**
	 * One person on the day's register: who, when they are due, where they are now, and the one or
	 * two buttons that matter at that moment — **In** before they arrive, **Out** while they are
	 * in. "In" and "Out" need no typing: the server stamps the clinic's clock (on a past day, the
	 * schedule). Times are corrected, and absences excused, from the dialogs the page owns.
	 */
	let {
		person,
		day,
		form,
		onedit,
		onexcuse
	}: {
		person: DayStatus & {
			id: number;
			name: string;
			position: string | null;
			record: { clockIn: string | null; clockOut: string | null; note: string | null } | null;
		};
		day: string;
		/** The register's one act form, shared by every row's buttons. */
		form: SuperValidated<Record<string, unknown>>;
		onedit: () => void;
		onexcuse: () => void;
	} = $props();

	const values = $derived({ staffId: person.id, day });
	const due = $derived(
		person.scheduled
			? `${person.scheduled.start.slice(0, 5)}–${person.scheduled.end.slice(0, 5)}`
			: 'Not scheduled'
	);
</script>

<li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
	<div class="min-w-48 flex-1">
		<p class="font-medium">{person.name}</p>
		<p class="text-sm text-muted-foreground">{person.position ?? '—'} · {due}</p>
	</div>

	<div class="flex min-w-56 flex-col items-start gap-1 text-sm">
		<DayBadge kind={person.kind} />
		{#if person.kind === 'present'}
			<span class="tabular-nums">
				In {person.record?.clockIn}{person.record?.clockOut
					? ` · out ${person.record.clockOut} · ${hoursAndMinutes(person.worked)} worked`
					: ''}
			</span>
			{#if person.late || person.early}
				<span class="text-muted-foreground">
					{person.late ? `${person.late} min late` : ''}{person.late && person.early
						? ' · '
						: ''}{person.early ? `left ${person.early} min early` : ''}
				</span>
			{/if}
		{:else if person.kind === 'excused'}
			<span class="text-muted-foreground">{person.record?.note}</span>
		{:else if person.kind !== 'off' && person.kind !== 'unjudged'}
			<span class="text-muted-foreground">{DAY_LABEL[person.kind].label}</span>
		{/if}
	</div>

	<div class="flex flex-wrap justify-end gap-2">
		{#if !person.record}
			<StepButton
				id="in-{person.id}"
				action="?/record"
				data={form}
				label="In"
				icon={LogIn}
				variant="default"
				values={{ ...values, act: 'in' }}
			/>
			{#if person.scheduled && person.kind !== 'leave' && person.kind !== 'closed'}
				<Button size="sm" variant="outline" onclick={onexcuse}>
					<ShieldCheck class="size-4" /> Excused
				</Button>
			{/if}
		{:else if person.open}
			<StepButton
				id="out-{person.id}"
				action="?/record"
				data={form}
				label="Out"
				icon={LogOut}
				variant="default"
				values={{ ...values, act: 'out' }}
			/>
		{/if}
		{#if person.record}
			{#if person.kind === 'present'}
				<Button size="sm" variant="ghost" onclick={onedit}><Pencil class="size-4" /> Times</Button>
			{/if}
			<StepButton
				id="clear-{person.id}"
				action="?/record"
				data={form}
				label="Undo"
				icon={Undo}
				variant="ghost"
				values={{ ...values, act: 'clear' }}
				confirm={{
					title: `Clear ${person.name}’s day?`,
					description:
						'What was recorded for the day is removed. On a working day with nothing recorded, that reads as an absence.',
					action: 'Clear it'
				}}
			/>
		{/if}
	</div>
</li>
