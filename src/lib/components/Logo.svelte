<script lang="ts">
	/**
	 * The amno logo, the one way it is put on a page.
	 *
	 * `static/newLogo.png` is a square with the lockup — mark, wordmark, "ERP SOLUTIONS" — in a band
	 * across the middle and a dark field above and below. Shown whole at the sizes the app uses, the
	 * wordmark is a few pixels tall. So it is shown as a 3:1 window onto that band (`object-cover`
	 * keeps the centre), which reads as a normal horizontal logo from the one file, with no cropped
	 * copies to keep in step when the artwork changes.
	 *
	 * The dark field is part of the artwork, so it is the same in light and dark themes.
	 */
	let { class: className = 'h-12' }: { class?: string } = $props();
</script>

<img
	src="/newLogo.png"
	alt="amno ERP Solutions"
	class="aspect-[3/1] w-auto rounded-md object-cover {className}"
/>
