<script lang="ts">
	import { enhance } from '$app/forms';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { useI18n } from '$lib/i18n/i18n.svelte';
	import { clinicClock, clinicDate } from '$lib/clinicTime';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import type { TextState } from '$lib/smsTemplates';

	/**
	 * A list row's text message: what has happened, and the button that sends one. Shared by the
	 * Reminders and Recalls lists, which post to their own actions with their own id field.
	 *
	 * The status comes from `textState`, the rule the server sends by, so a patient who asked not to
	 * be texted, or has no mobile number, is shown that instead of a button the server would refuse.
	 * The reply is a toast (the root layout shows `form.message`), and the list reloads with it.
	 */
	let {
		action,
		field,
		id,
		status,
		textedAt,
		canSend
	}: {
		/** `?/textReminder`, `?/textRecall`. */
		action: string;
		/** The posted id's name: `appointmentId`, `recallId`. */
		field: string;
		id: number;
		status: TextState;
		textedAt: Date | string | null;
		/** A gateway is set up and the viewer may send. */
		canSend: boolean;
	} = $props();

	const t = useI18n();
	const s = $derived(t.m.common.sms);
	let busy = $state(false);

	const when = $derived(
		textedAt
			? clinicDate(textedAt) === clinicDate(new Date())
				? clinicClock(textedAt)
				: formatEthiopianDate(new Date(textedAt))
			: ''
	);
</script>

<div class="flex items-center justify-end gap-2 text-sm">
	{#if status === 'texted'}
		<span class="text-muted-foreground">{s.texted(when)}</span>
	{:else if status === 'optedOut'}
		<span class="text-muted-foreground">{s.optedOut}</span>
	{:else if status === 'noMobile'}
		<span class="text-muted-foreground">{s.noMobile}</span>
	{/if}
	{#if canSend && (status === 'ready' || status === 'texted')}
		<form
			method="post"
			{action}
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}}
		>
			<input type="hidden" name={field} value={id} />
			<Button
				type="submit"
				size="sm"
				variant={status === 'texted' ? 'ghost' : 'outline'}
				disabled={busy}
			>
				<MessageSquare class="size-4" />
				{status === 'texted' ? s.textAgain : s.text}
			</Button>
		</form>
	{/if}
</div>
