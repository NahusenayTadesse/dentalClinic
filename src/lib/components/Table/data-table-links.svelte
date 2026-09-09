<script lang="ts">
	import type { Component } from 'svelte';
	import type { IconProps } from '@lucide/svelte';
	let {
		id,
		IconComp,
		name,
		link,
		variant = 'ghost',
		target = ''
	}: {
		/**
		 * Appended to `link` to build the href. Numeric because most tables here are keyed by an
		 * autoincrement `int` — only `user` uses a string id — and the value is interpolated into
		 * a URL either way.
		 */
		id: string | number | null;
		name: string | null;
		link: string;
		target?: string;
		IconComp?: Component<IconProps>;
		variant?: ButtonVariant;
	} = $props();
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button, type ButtonVariant } from '$lib/components/ui/button/index.js';

	import { buttonVariants } from '../ui/button/index.js';
</script>

<Tooltip.Provider>
	<Tooltip.Root>
		<Tooltip.Trigger class={buttonVariants({ variant: 'ghost' })}>
			{#snippet child({ props })}
				<Button
					href={id === null ? undefined : `${link}/${id}`}
					{target}
					{variant}
					{...props}
					class="wrap-break-words items-end! justify-start!  {variant === 'ghost' ? 'pl-0' : ''}"
				>
					{#if IconComp}
						<IconComp class="size-4" />
					{/if}
					{name}
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content class="left-0 justify-self-start">
			<p class="text-[13px]!">Goto {name}</p>
		</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
