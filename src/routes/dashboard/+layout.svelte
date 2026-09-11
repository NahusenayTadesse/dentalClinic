<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import DarkMode from '$lib/components/DarkMode.svelte';
	import Search from '$lib/components/Search.svelte';
	import AvatarSettings from '$lib/components/AvatarSettings.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { CloudDownload } from '@lucide/svelte';
	import HelpButton from '$lib/components/HelpButton.svelte';
	import { canVisit } from '$lib/routeAccess';
	import { setViewer } from '$lib/viewer.svelte';

	let { children, data } = $props();

	// Set once, here, so any mention of a record anywhere below can decide whether to be a link
	// without the permission list being threaded through every columns.ts. Passed as a getter so
	// it tracks rather than freezing the list captured at mount.
	setViewer(() => data?.permList);

	// A backup is the whole database in one file. The route is gated on the server; this keeps
	// the button from offering something the click would refuse.
	let canDownloadBackup = $derived(canVisit('/dashboard/backup', data?.permList));
</script>

<Sidebar.Provider>
	<AppSidebar permList={data?.permList} />
	<main class="min-w-0 flex-1 px-2">
		<div
			class="absolute top-2 left-2 z-50 flex w-[95%] flex-row
			justify-between rounded-lg p-2 pr-4 align-middle
		 shadow-lg backdrop-blur-md lg:sticky lg:w-full lg:pr-2"
		>
			<Sidebar.Trigger class="rounded-lg bg-white p-4 dark:bg-black" />
			<div class="flex flex-row items-center gap-4">
				<Search />
				<HelpButton />
				<DarkMode />
				<AvatarSettings data={data?.role?.name} />
				{#if canDownloadBackup}
					<Button
						href="/dashboard/backup"
						title="Download Database Backup"
						variant="outline"
						size="icon"
					>
						<CloudDownload class={data?.download ? 'animate-ping text-destructive' : ''} />
					</Button>
				{/if}
			</div>
		</div>
		<div class="overflow-hidden p-2 pt-24 pb-24 lg:pt-4 lg:pb-4">
			{@render children?.()}

			<br />
		</div>
	</main>
</Sidebar.Provider>
