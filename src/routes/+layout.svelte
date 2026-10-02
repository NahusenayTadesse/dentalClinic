<script lang="ts">
	import '../app.css';
	import { getFlash } from 'sveltekit-flash-message';
	import { page, updated } from '$app/state';
	import { Toaster } from '@nahu/admin-kit/components/ui/sonner/index.js';
	import { ProgressBar } from '@prgm/sveltekit-progress-bar';
	import { setKitLabels } from '@nahu/admin-kit/labels';

	// The kit's date pickers draw their grids in Amharic, as this app's own pickers always did.
	setKitLabels({ dateLocale: 'am-ET' });

	const flash = getFlash(page, { clearAfterMs: 5000 });

	import { ModeWatcher } from 'mode-watcher';

	import { toast } from 'svelte-sonner';

	let { children } = $props();

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
		if (updated.current) toast.success('A new version is available, please reload the page');
	});
</script>

<svelte:head>
	<link rel="icon" href="/newLogo.png" />
</svelte:head>
<ModeWatcher />
<Toaster position="bottom-right" richColors closeButton />

<ProgressBar color="#10182b" zIndex={100} />

{@render children()}
