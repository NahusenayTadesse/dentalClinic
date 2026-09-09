<script lang="ts">
	/**
	 * The transitions that need nothing but a sentence: reject, cancel, close.
	 * Each posts to its own action with its own superform, so they stay separate
	 * server-side even though they look identical here.
	 */
	import { Button } from '$lib/components/ui/button/index.js';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { superForm } from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import type { Component } from 'svelte';
	import type { IconProps } from '@lucide/svelte';
	import type { ButtonVariant } from '$lib/components/ui/button/index.js';

	let {
		data,
		action,
		title,
		description = '',
		field = 'reason',
		label = 'Reason',
		placeholder = '',
		required = true,
		variant = 'outline',
		IconComp,
		submitLabel = title
	}: {
		data: any;
		/** Form action, e.g. `?/reject`. */
		action: string;
		title: string;
		description?: string;
		/** `reason` for reject/cancel, `note` for close. */
		field?: string;
		label?: string;
		placeholder?: string;
		required?: boolean;
		variant?: ButtonVariant;
		IconComp?: Component<IconProps>;
		submitLabel?: string;
	} = $props();

	let isOpen = $state(false);

	const { form, errors, enhance, delayed, message } = superForm(data, {
		// Closing on success is what tells the user it worked; the page data
		// reloads underneath.
		onUpdated({ form: result }) {
			if (result.message?.type === 'success') isOpen = false;
		}
	});

	$effect(() => {
		if ($message) {
			if ($message.type === 'error') toast.error($message.text);
			else toast.success($message.text);
		}
	});
</script>

<DialogComp {title} {description} {variant} {IconComp} bind:open={isOpen}>
	<form method="post" {action} use:enhance class="flex w-full flex-col gap-3 pt-2">
		<InputComp
			{label}
			name={field}
			type="textarea"
			rows={3}
			{required}
			{placeholder}
			{form}
			{errors}
		/>

		<Button type="submit" {variant} size="lg">
			{#if $delayed}
				<LoadingBtn name={submitLabel} />
			{:else}
				{#if IconComp}<IconComp />{/if}
				{submitLabel}
			{/if}
		</Button>
	</form>
</DialogComp>
