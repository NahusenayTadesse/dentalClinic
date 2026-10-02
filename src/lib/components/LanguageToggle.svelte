<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Languages from '@lucide/svelte/icons/languages';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { useI18n } from '$lib/i18n/i18n.svelte';

	/**
	 * Switches the interface between English and Amharic. Posts the choice to `/language`, which
	 * keeps it in a cookie, then reloads the page's data so every screen redraws in it — nothing on
	 * the page is lost, because nothing is navigated away from.
	 */
	const t = useI18n();
	let busy = $state(false);

	async function toggle() {
		busy = true;
		try {
			await fetch('/language', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ lang: t.lang === 'en' ? 'am' : 'en' })
			});
			await invalidateAll();
		} finally {
			busy = false;
		}
	}
</script>

<Button
	variant="outline"
	size="sm"
	onclick={toggle}
	disabled={busy}
	aria-label={t.m.common.switchToAria}
	title={t.m.common.switchToAria}
>
	<Languages class="size-4" />
	<span class="hidden sm:inline">{t.m.common.switchTo}</span>
</Button>
