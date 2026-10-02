<script lang="ts">
	import '../app.css';
	import { getFlash } from 'sveltekit-flash-message';
	import { page, updated } from '$app/state';
	import { Toaster } from '@nahu/admin-kit/components/ui/sonner/index.js';
	import { ProgressBar } from '@prgm/sveltekit-progress-bar';
	import { setKitLabels } from '@nahu/admin-kit/labels';
	import { setLanguage } from '$lib/i18n/i18n.svelte';
	import { MESSAGES } from '$lib/i18n/messages';

	const flash = getFlash(page, { clearAfterMs: 5000 });

	import { ModeWatcher } from 'mode-watcher';

	import { toast } from 'svelte-sonner';

	let { children, data } = $props();

	// The viewer's language for every component below, and the kit's words in it — both read at
	// render through a getter, so switching language needs no remount (`$lib/i18n/i18n.svelte.ts`).
	const lang = () => data.lang ?? 'en';
	setLanguage(lang);
	setKitLabels(() => MESSAGES[lang()].kit);
	// The server writes `<html lang>` on a full load; a switch reloads only data, so follow it here.
	$effect(() => {
		document.documentElement.lang = lang();
	});

	$effect(() => {
		const form = page.form;
		if (form?.message) {
			if (form.message.type === 'error') {
				toast.error(form.message.text);
			} else {
				toast.success(form.message.text);
			}
		}
		if (!$flash) return;
		if (page.data.flash?.type === 'success') toast.success($flash.message);
		if (page.data.flash?.type === 'error') toast.error($flash?.message);
		$flash = undefined;
		if (updated.current) toast.success(MESSAGES[lang()].common.newVersion);
	});
</script>

<svelte:head>
	<link rel="icon" href="/newLogo.png" />
</svelte:head>
<ModeWatcher />
<Toaster position="bottom-right" richColors closeButton />

<ProgressBar color="#10182b" zIndex={100} />

{@render children()}
