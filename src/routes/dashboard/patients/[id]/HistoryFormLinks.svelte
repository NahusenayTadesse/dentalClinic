<script lang="ts">
	import Printer from '@lucide/svelte/icons/printer';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	/**
	 * The medical-history questionnaire, to print for the patient to fill in and sign — in Amharic
	 * or English, whichever they read, whatever the screen is in. Its own file because the overview
	 * is at its size limit (CLAUDE.md §6).
	 */
	let { patientId }: { patientId: number } = $props();

	const t = useI18n();
	const href = (lang: string) => `/dashboard/patients/${patientId}/history-form?lang=${lang}`;
</script>

<div class="flex flex-wrap items-center gap-2 text-sm">
	<Printer class="size-4 text-muted-foreground" />
	<span class="text-muted-foreground">{t.m.patients.overview.printQuestionnaire}</span>
	<Button size="sm" variant="outline" href={href('am')} target="_blank">አማርኛ</Button>
	<Button size="sm" variant="outline" href={href('en')} target="_blank">English</Button>
</div>
