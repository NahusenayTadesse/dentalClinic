<script>
	import { fileUrl } from '$lib/global.svelte';

	let { title, children, class: className = '', photo = '' } = $props();
</script>

<div
	class="flex w-full flex-col items-center justify-center rounded-md
 bg-white shadow-lg lg:w-md lg:min-w-3xl dark:bg-black dark:shadow-md dark:shadow-gray-900 {className}"
>
	<div
		class="flex w-full flex-col items-center justify-start rounded-t-lg border-b bg-muted px-8 py-6 text-foreground"
	>
		{#if photo !== ''}
			<img src={fileUrl(photo)} loading="lazy" class="h-48 w-48 rounded-full" alt="{title} photo" />
		{/if}
		<h1 class="text-center">{title}</h1>
	</div>

	{@render children()}
</div>
