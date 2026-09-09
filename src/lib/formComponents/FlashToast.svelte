<script>
	import { toast } from 'svelte-sonner';
	let { message } = $props();
	$effect(() => {
		if (message) {
			if (message.type === 'error') {
				toast.error(message.text);
			} else {
				toast.success(message.text);
			}
		}
	});
</script>
