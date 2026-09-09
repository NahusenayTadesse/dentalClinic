<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';

	import { ArrowBigLeft } from '@lucide/svelte';
	let { children, data } = $props();
</script>

<div class="mb-8 flex flex-row flex-wrap items-center justify-start gap-2">
	<Button href="/dashboard/employees/single/{page.params.id}"
		><ArrowBigLeft /> Back to {data?.staffMember?.firstName}</Button
	>
</div>

{@render children()}
