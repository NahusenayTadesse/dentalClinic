<script lang="ts">
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';

	/**
	 * Where a gateway sends the patient's phone after a checkout. Public, and says nothing about
	 * the payment or the patient: anyone can open this address, and the gateway's own redirect is
	 * not proof of anything — the clinic records the payment only when the gateway confirms it.
	 */
	const cancelled = $derived(page.url.searchParams.get('cancelled') === '1');
</script>

<svelte:head>
	<title>Payment</title>
</svelte:head>

<main
	class="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center"
>
	<Logo />
	{#if cancelled}
		<h1 class="text-2xl font-bold">ክፍያው አልተጠናቀቀም · The payment was not completed</h1>
		<p class="max-w-md text-muted-foreground">
			ምንም ገንዘብ አልተወሰደም። እንደገና ለመክፈል ከክሊኒኩ የተላከልዎትን ሊንክ ይጠቀሙ።
			<br />
			Nothing was taken. To try again, use the link the clinic sent you.
		</p>
	{:else}
		<h1 class="text-2xl font-bold">እናመሰግናለን · Thank you</h1>
		<p class="max-w-md text-muted-foreground">
			ክፍያዎ ሲረጋገጥ ክሊኒኩ ይመዘግበዋል፤ ደረሰኝዎን ከክሊኒኩ ያገኛሉ። ይህን ገጽ መዝጋት ይችላሉ።
			<br />
			The clinic records your payment as soon as the gateway confirms it, and your receipt is at the clinic.
			You can close this page.
		</p>
	{/if}
</main>
