<script lang="ts">
	import AdminNavCard from '$lib/components/AdminCard.svelte';
	import { canVisit } from '$lib/routeAccess';
	import { viewer } from '$lib/viewer.svelte';
	import { settingsSections } from '$lib/navigation';

	/**
	 * The admin panel's index: one card per section, built from the same list as the sidebar so
	 * the two cannot disagree about what exists or where it lives.
	 */
	const me = viewer();
	let sections = $derived(settingsSections((url) => canVisit(url, me.permList)));
</script>

<svelte:head>
	<title>Admin Panel</title>
</svelte:head>

<main class="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12 text-foreground">
	<div class="flex flex-col gap-4">
		<h2 class="text-4xl font-bold tracking-tight">Admin panel</h2>
		<p class="max-w-2xl text-lg text-muted-foreground">
			The lists the rest of the system picks from. Change them here, and every form that offers them
			follows.
		</p>
	</div>

	<div class="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
		{#each sections as section (section.key)}
			<AdminNavCard
				title={section.title}
				description={section.description}
				icon={section.icon}
				items={section.items}
			/>
		{/each}
	</div>
</main>
