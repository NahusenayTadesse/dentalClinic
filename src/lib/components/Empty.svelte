<script>
	import { Frown } from "@lucide/svelte";

    let { title=''} = $props();

</script>
<div class="flex items-center my-8 justify-center w-full h-64 dark:bg-black rounded-md shadow-sm p-6">
	<h1 aria-live="assertive" class="text-5xl md:text-6xl font-extrabold uppercase text-center text-red-600 dark:text-red-400">
	<Frown class="text-center justify-self-center w-32 h-32 animate-bounce"/>	No {title} with this id, It has been deleted or it has never existed.
	</h1>
</div>