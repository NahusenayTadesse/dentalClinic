<script lang="ts">
	import Login from '$lib/forms/Login.svelte';
	
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData, form: ActionData  } = $props();
	
</script>
<svelte:head>
	<title>Login</title>
</svelte:head>


<div class="flex h-screen w-full items-center justify-center px-4">

<Login data={data?.form}  action="?/login"/>
</div>

<!-- <form method="post" action="?/login" use:enhance>
	<label>
		Username
		<input
			name="username"
			class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</label>
	<label>
		Password
		<input
			type="password"
			name="password"
			class="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</label>
	<button class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
		>Login</button
	>
	<button
		formaction="?/register"
		class="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
		>Register</button
	>
</form>
<p style="color: red">{form?.message ?? ''}</p> -->
