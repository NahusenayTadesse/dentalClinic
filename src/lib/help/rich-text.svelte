<script lang="ts">
	/**
	 * Renders the light markup the manual is written in — `**bold**` for things
	 * you click, and `` `code` `` for literal text: a route, a column name, a
	 * permission.
	 *
	 * Parsed into tokens and rendered as real elements rather than injected as
	 * HTML. The content is ours today, but a help page is exactly the sort of
	 * thing that later grows an editable version, and an {@html} here would be
	 * waiting to become an injection hole the day it does.
	 */
	let { text }: { text: string } = $props();

	type Token = { kind: 'plain' | 'strong' | 'code'; value: string };

	const tokens = $derived.by((): Token[] => {
		const out: Token[] = [];
		const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
		let last = 0;
		let match: RegExpExecArray | null;

		while ((match = pattern.exec(text)) !== null) {
			if (match.index > last) out.push({ kind: 'plain', value: text.slice(last, match.index) });
			if (match[1] !== undefined) out.push({ kind: 'strong', value: match[1] });
			else out.push({ kind: 'code', value: match[2] });
			last = match.index + match[0].length;
		}

		if (last < text.length) out.push({ kind: 'plain', value: text.slice(last) });
		return out;
	});
</script>

{#each tokens as token, i (i)}
	{#if token.kind === 'strong'}
		<strong class="font-semibold text-foreground">{token.value}</strong>
	{:else if token.kind === 'code'}
		<code class="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] break-words"
			>{token.value}</code
		>
	{:else}
		{token.value}
	{/if}
{/each}
