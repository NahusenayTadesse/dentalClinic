<script lang="ts">
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import Phone from '@lucide/svelte/icons/phone';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	/** A recall row's two actions: book the visit it is for, or log a call. */
	let {
		patientId,
		appointmentTypeId,
		oncall
	}: { patientId: number; appointmentTypeId: number | null; oncall: () => void } = $props();

	const book = $derived(
		`/dashboard/appointments?book=${patientId}${appointmentTypeId ? `&type=${appointmentTypeId}` : ''}`
	);
</script>

<div class="flex justify-end gap-1">
	<Button variant="ghost" size="sm" onclick={oncall}><Phone class="size-4" /> Log a call</Button>
	<Button href={book} size="sm"><CalendarPlus class="size-4" /> Book</Button>
</div>
