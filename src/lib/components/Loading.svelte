<script>
	import { Loader } from "@lucide/svelte";

    let { name } = $props()
</script>


<div class="fixed z-1 flex flex-col justify-center top-0.5 bottom-0.5 left-0.5 right-0.5 w-auto items-center">
    <div class="flex flex-row gap-2 items-center">
		  <Loader class="animate-spin w-8 h-8"/><h1 class="animate-pulse capitalize">Loading {name}...</h1>
    </div>
    </div>