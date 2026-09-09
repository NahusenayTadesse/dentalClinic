<script>
	import { Frown } from '@lucide/svelte';

	let { title = '' } = $props();
</script>

<div
	class="my-8 flex h-64 w-full items-center justify-center rounded-md p-6 shadow-sm dark:bg-black"
>
	<h1
		aria-live="assertive"
		class="text-center text-5xl font-extrabold text-red-600 uppercase md:text-6xl dark:text-red-400"
	>
		<Frown class="h-32 w-32 animate-bounce justify-self-center text-center" /> No {title} with this id,
		It has been deleted or it has never existed.
	</h1>
</div>
