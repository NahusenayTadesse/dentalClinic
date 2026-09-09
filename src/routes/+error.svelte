<script>
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
</script>

<svelte:head>
	<title>Error {page.error?.message}</title>
</svelte:head>
<div class="flex h-screen w-screen flex-col items-center justify-center">
	<h1 class="text-5xl text-red-600">{page.status}</h1>

	<h3 class="font-head text-2xl text-red-600">{@html page.error?.message}</h3>

	<Button href="/dashboard">Back to Dashboard</Button>
</div>
