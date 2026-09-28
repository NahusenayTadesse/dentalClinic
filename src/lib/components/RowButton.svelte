<script lang="ts">
	/**
	 * A table cell that opens something for its row — the one shared edit dialog on the dental chart and the payment methods. A button,
	 * not a link: it changes nothing about the URL, and a screen reader should say so.
	 */
	let { label, onclick }: { label: string; onclick: () => void } = $props();
</script>

<button type="button" class="text-left font-medium underline-offset-2 hover:underline" {onclick}>
	{label}
</button>
