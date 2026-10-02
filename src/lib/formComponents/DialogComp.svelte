<script lang="ts">
	import * as Dialog from '@nahu/admin-kit/components/ui/dialog/index.js';
	import { Button, type ButtonVariant } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Trash } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import type { Component } from 'svelte';
	import type { IconProps } from '@lucide/svelte';

	import ScrollArea from '@nahu/admin-kit/components/ui/scroll-area/scroll-area.svelte';

	let {
		title,
		description,
		children,
		trigger,
		header,
		variant,
		IconComp,
		open = $bindable(false),
		triggerClass = '',

		class: className = ''
	}: {
		title: string;
		description?: string;
		children: Snippet;
		trigger?: Snippet<[Record<string, unknown>]>;
		header?: Snippet;
		variant: ButtonVariant;
		IconComp?: Component<IconProps>;
		open?: boolean;
		triggerClass?: string;
		class?: string;
	} = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class="w-auto border-0">
		{#snippet child({ props })}
			{#if trigger}
				{@render trigger(props)}
			{:else}
				<Button size="sm" class="border-0 {triggerClass}" {variant} {...props}>
					{#if IconComp}
						<IconComp />
					{:else if variant === 'destructive'}
						<Trash />
					{/if}
					{title}
				</Button>
			{/if}
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="w-lg! {className}">
		{#if header}
			{@render header()}
		{:else}
			<Dialog.Header>
				<Dialog.Title>{title}</Dialog.Title>
				{#if description}
					<Dialog.Description>{description}</Dialog.Description>
				{/if}
			</Dialog.Header>
		{/if}
		<ScrollArea class="h-auto w-full! min-w-0!  px-2 pr-4" orientation="both">
			<div class="h-auto max-h-96 w-full lg:max-h-[calc(100vh-10rem)]">
				{@render children()}
			</div>
		</ScrollArea>
	</Dialog.Content>
</Dialog.Root>
