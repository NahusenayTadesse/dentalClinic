<script lang="ts">
	import { Copy, CopyCheck } from '@lucide/svelte';

	let message = $state('');
	let copied = $state(false);

	let Copyicon = $derived(copied ? CopyCheck : Copy);

	async function copyPhoneNumber(copiedText: string) {
		try {
			await navigator.clipboard.writeText(copiedText);
			message = 'Copied!';
			copied = true;

			setTimeout(() => {
				message = '';
				copied = false;
			}, 2000);
		} catch (err) {
			message = 'Failed to copy!';
			copied = false;
			console.error(err);

			setTimeout(() => {
				message = '';
				copied = false;
			}, 2000);
		}
	}

	let visible = $state(false);
	let { data } = $props();
</script>

<button
	onclick={() => copyPhoneNumber(data)}
	title="Copy {data}"
	onmouseenter={() => (visible = true)}
	onmouseleave={() => (visible = false)}
>
	{data}
	<span class="relative p-4">
		{#if visible}
			<Copyicon class="absolute top-2 right-0 h-4 w-4  text-black dark:text-white" />
		{/if}
	</span>
</button>
