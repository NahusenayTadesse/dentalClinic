<script>
	let { title, children, class: className = '', photo = '' } = $props();
</script>

<div
	class="flex w-full flex-col items-center justify-center rounded-md
 bg-white shadow-lg lg:w-md lg:min-w-3xl dark:bg-black dark:shadow-md dark:shadow-gray-900 {className}"
>
	<div
		class="from-dark flex w-full flex-col items-center justify-start rounded-lg bg-linear-to-r from-gray-200 to-black px-8 py-6 text-white dark:from-gray-600"
	>
		{#if photo !== ''}
			<img
				src="/dashboard/files/{photo}"
				loading="lazy"
				class="h-48 w-48 rounded-full"
				alt="{title} photo"
			/>
		{/if}
		<h1 class="text-center">{title}</h1>
	</div>

	{@render children()}
</div>
