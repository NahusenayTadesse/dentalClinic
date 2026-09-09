<script>
	import { ArrowBigLeft } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	let { data } = $props();

	import IdCard from './IdCard.svelte';
	import { page } from '$app/state';
</script>

<svelte:head></svelte:head>
<Button href="/dashboard/employees/single/{page.params.id}"
	><ArrowBigLeft /> Back to {data?.staffMember?.firstName}</Button
>
<IdCard staff={data?.staffMember} />
