<script lang="ts">
	import Phone from '@lucide/svelte/icons/phone';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	/** A reminder row's action: say the patient has been reminded. */
	let { reminded, onremind }: { reminded: boolean; onremind: () => void } = $props();
</script>

<div class="flex justify-end">
	<Button variant={reminded ? 'ghost' : 'default'} size="sm" onclick={onremind}>
		<Phone class="size-4" />
		{reminded ? 'Remind again' : 'Reminded'}
	</Button>
</div>
