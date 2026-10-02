<script lang="ts">
	import Phone from '@lucide/svelte/icons/phone';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	/** A reminder row's action: say the patient has been reminded. */
	let { reminded, onremind }: { reminded: boolean; onremind: () => void } = $props();

	const t = useI18n();
	const r = $derived(t.m.appointments.reminders);
</script>

<div class="flex justify-end">
	<Button variant={reminded ? 'ghost' : 'default'} size="sm" onclick={onremind}>
		<Phone class="size-4" />
		{reminded ? r.remindAgain : r.reminded}
	</Button>
</div>
