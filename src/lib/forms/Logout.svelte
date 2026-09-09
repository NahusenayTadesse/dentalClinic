<script>
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import { LogOut } from '@lucide/svelte';
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	let open = $state(false);

	let deleting = $state(false);

	import { toast } from 'svelte-sonner';
</script>

<DialogComp title="Logout" variant="destructive" IconComp={LogOut} bind:open>
	<h5 class="text-center">Are you sure you want to Logout?</h5>
	<div class="flex flex-row items-center justify-center gap-4 pt-4">
		<form
			method="post"
			action="/dashboard/?/logout"
			use:enhance={() => {
				deleting = true; // 1. start spinner

				return async ({ result, update }) => {
					await update(); // 2. apply action result to page
					deleting = false;
					if (result.type === 'success') {
						toast.success('Logged out successfully');
					} else {
						toast.error('Failed to log out');
					}
					// 3. stop spinner
				};
			}}
		>
			<Button type="submit" disabled={deleting} variant="destructive" size="lg">
				{#if deleting}
					<LoadingBtn name="Logging Out" />
				{:else}
					<LogOut /> Logout
				{/if}
			</Button>
		</form>

		<Button onclick={() => (open = false)} size="lg">Cancel</Button>
	</div>
</DialogComp>
