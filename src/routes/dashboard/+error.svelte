   <script> 
    import { page } from '$app/state'
	import { Button } from '$lib/components/ui/button';
 </script>
<div class="w-full h-full flex flex-col justify-center items-center">
 <h1 class="text-red-600 text-5xl">{page.status}</h1>

 <h3 class="text-red-600 font-head text-2xl">{@html page.error?.message}</h3>

 <Button href="/dashboard" >Back to Dashboard</Button>

 </div>