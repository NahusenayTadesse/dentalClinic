<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { enhance } from '$app/forms';
	import { Trash } from '@lucide/svelte';

	let {
		entity,
		name = '',
		consequence = '',
		canDelete = false,
		action = '?/delete',
		id = undefined,
		icon = false
	}: {
		/** Singular label for the thing being deleted, e.g. "Customer". */
		entity: string;
		/** The specific record's name, shown so the user can confirm what they hit. */
		name?: string;
		/** What else goes with it — spell out any cascade. */
		consequence?: string;
		/** Only a super admin gets the button at all. */
		canDelete?: boolean;
		action?: string;
		/**
		 * Row id, for list rows where the action cannot read it from the URL.
		 * Posted as a hidden field; the server still re-checks the row's owner.
		 */
		id?: number | string;
		/** Icon-only trigger, for table cells where a labelled button is too wide. */
		icon?: boolean;
	} = $props();

	let submitting = $state(false);
</script>

{#if canDelete}
	<AlertDialog.Root>
		<AlertDialog.Trigger
			class={buttonVariants({
				variant: icon ? 'ghost' : 'destructive',
				size: icon ? 'icon' : 'default'
			})}
			title="Delete {entity}"
			aria-label="Delete {entity}{name ? ` ${name}` : ''}"
		>
			<Trash class="size-4 {icon ? 'text-destructive' : ''}" />
			{#if !icon}Delete {entity}{/if}
		</AlertDialog.Trigger>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Delete this {entity.toLowerCase()}?</AlertDialog.Title>
				<AlertDialog.Description>
					{#if name}
						<strong>{name}</strong> will be removed from every page in the system.
					{:else}
						This {entity.toLowerCase()} will be removed from every page in the system.
					{/if}
					{#if consequence}
						{consequence}
					{/if}
				</AlertDialog.Description>
			</AlertDialog.Header>
			<form
				method="post"
				{action}
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				{#if id !== undefined}
					<input type="hidden" name="id" value={id} />
				{/if}
				<AlertDialog.Footer>
					<AlertDialog.Cancel type="button">Cancel</AlertDialog.Cancel>
					<AlertDialog.Action class={buttonVariants({ variant: 'destructive' })}>
						{#snippet child({ props })}
							<Button type="submit" disabled={submitting} {...props}>
								{#if submitting}
									<LoadingBtn name="Deleting {entity}" />
								{:else}
									<Trash class="size-4" /> Delete {entity}
								{/if}
							</Button>
						{/snippet}
					</AlertDialog.Action>
				</AlertDialog.Footer>
			</form>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
