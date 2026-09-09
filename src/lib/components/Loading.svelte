<script>
	import { Loader } from '@lucide/svelte';

	let { name } = $props();
</script>

<div
	class="fixed top-0.5 right-0.5 bottom-0.5 left-0.5 z-1 flex w-auto flex-col items-center justify-center"
>
	<div class="flex flex-row items-center gap-2">
		<Loader class="h-8 w-8 animate-spin" />
		<h1 class="animate-pulse capitalize">Loading {name}...</h1>
	</div>
</div>
