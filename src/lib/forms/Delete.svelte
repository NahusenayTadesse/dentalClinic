<script>
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Trash } from '@lucide/svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { goto } from '$app/navigation';
	let isOpen = $state(false);

	let { redirect = '/dashboard' } = $props();

	let deleting = $state(false);
	import { updateFlash } from 'sveltekit-flash-message';
	import { page } from '$app/state';
</script>

<DialogComp title="Delete" variant="destructive" bind:open={isOpen}>
	<h5 class="text-center">Are you sure you want to Delete? This action is irreversable</h5>
	<div class="flex flex-row items-center justify-center gap-4 pt-4">
		<form
			method="post"
			action="?/delete"
			use:enhance={() => {
				deleting = true; // 1. start spinner

				return async ({ result, update }) => {
					await update(); // 2. apply action result to page
					deleting = false; // 3. stop spinner
					updateFlash(page);
					if (result.type === 'success') {
						await goto(redirect);

						// 4. navigate on success
					}
				};
			}}
		>
			<Button type="submit" disabled={deleting} variant="destructive" size="lg">
				{#if deleting}
					<LoadingBtn name="Deleting" />
				{:else}
					<Trash /> Delete
				{/if}
			</Button>
		</form>

		<Button onclick={() => (isOpen = false)} size="lg">Cancel</Button>
	</div>
</DialogComp>
