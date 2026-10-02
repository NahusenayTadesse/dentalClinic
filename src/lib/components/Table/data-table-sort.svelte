<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';

	let { variant = 'ghost', name, ...restProps }: ComponentProps<typeof Button> = $props();
</script>

<Button {variant} class="text-center!" {...restProps}>
	{name}
	<ArrowUpDownIcon class="" />
</Button>
