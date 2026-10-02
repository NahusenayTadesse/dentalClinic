<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Avatar from '@nahu/admin-kit/components/ui/avatar/index.js';

	import { LogOut, KeyRound } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { goto } from '$app/navigation';
	let { data }: { data: string | undefined } = $props();

	let deleting = $state(false);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		<Avatar.Root>
			<Avatar.Fallback
				class="flex items-center justify-center  rounded-full border-0 bg-primary font-medium text-primary-foreground"
			>
				{data?.[0].toUpperCase()}
			</Avatar.Fallback>
		</Avatar.Root>
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="p-2">
		<DropdownMenu.Group>
			<DropdownMenu.Label>My Account</DropdownMenu.Label>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onclick={() => goto('/dashboard/change-password')}>
				<KeyRound /> Change Password
			</DropdownMenu.Item>
			<DropdownMenu.Item>
				<form
					method="post"
					action="/dashboard/?/logout"
					use:enhance={() => {
						deleting = true; // 1. start spinner

						return async ({ update }) => {
							await update(); // 2. apply action result to page
							deleting = false; // 3. stop spinner
						};
					}}
				>
					<button
						type="submit"
						disabled={deleting}
						class="flex flex-row items-center justify-center gap-2"
					>
						{#if deleting}
							<LoadingBtn name="Logging Out" />
						{:else}
							<LogOut class="" /> Logout
						{/if}
					</button>
				</form></DropdownMenu.Item
			>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
