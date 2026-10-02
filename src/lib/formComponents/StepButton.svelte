<script lang="ts">
	import type { Component } from 'svelte';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { IconProps } from '@lucide/svelte';
	import * as AlertDialog from '@nahu/admin-kit/components/ui/alert-dialog/index.js';
	import { Button, type ButtonVariant } from '@nahu/admin-kit/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { createForm } from '$lib/forms/createForm';

	/**
	 * A step with nothing to fill in — complete a plan, discard a draft, issue a bill, take a line off —
	 * as a button that posts to its action. It is still a form through `createForm`, so the answer
	 * comes back as the same toast every other save gives (CLAUDE.md §13).
	 *
	 * `confirm` asks first, for a step that cannot be undone. `id` must be unique on the page: one
	 * `SuperValidated` serves every row's button, and superforms tells the forms apart by it.
	 */
	let {
		id,
		action,
		data,
		label,
		icon: Icon,
		variant = 'outline',
		values = {},
		confirm
	}: {
		id: string;
		action: string;
		data: SuperValidated<Record<string, unknown>>;
		label: string;
		icon?: Component<IconProps>;
		variant?: ButtonVariant;
		/** Hidden fields posted with the step — which line, say. */
		values?: Record<string, string | number>;
		confirm?: { title: string; description: string; action: string };
	} = $props();

	// svelte-ignore state_referenced_locally
	const { enhance, delayed } = createForm(data, undefined, { id });

	let asking = $state(false);
	let formEl = $state<HTMLFormElement>();
</script>

<form method="post" {action} use:enhance bind:this={formEl} class="contents">
	{#each Object.entries(values) as [name, value] (name)}
		<input type="hidden" {name} {value} />
	{/each}
	{#if confirm}
		<Button type="button" size="sm" {variant} onclick={() => (asking = true)}>
			{#if Icon}<Icon class="size-4" />{/if}
			{label}
		</Button>
	{:else}
		<Button type="submit" size="sm" {variant} disabled={$delayed}>
			{#if $delayed}
				<LoadingBtn name={label} />
			{:else}
				{#if Icon}<Icon class="size-4" />{/if}
				{label}
			{/if}
		</Button>
	{/if}
</form>

{#if confirm}
	<AlertDialog.Root bind:open={asking}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>{confirm.title}</AlertDialog.Title>
				<AlertDialog.Description>{confirm.description}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Keep it</AlertDialog.Cancel>
				<AlertDialog.Action
					onclick={() => {
						asking = false;
						formEl?.requestSubmit();
					}}
				>
					{confirm.action}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
