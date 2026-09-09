<script>
	let { message } = $props();
</script>

{#if $message}
	<p class={$message.type === 'error' ? 'text-red-500' : 'text-green-500'}>
		{$message ? $message.text : ''}
	</p>
{/if}
