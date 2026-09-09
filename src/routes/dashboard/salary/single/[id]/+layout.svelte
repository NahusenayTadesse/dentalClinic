<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';
	import { CalendarArrowDown, History, Pen, Plus, Sheet } from '@lucide/svelte';
	let { data, children } = $props();

	let today = new Date().toLocaleDateString('en-CA');
</script>

{@render children()}
