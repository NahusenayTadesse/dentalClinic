<script lang="ts">
	/**
	 * One card on a detail page: an icon, a title, an optional edit control, and the content.
	 *
	 * Shared since the patient page became its third user. The employee and customer pages each
	 * carried a byte-identical `section.svelte` of their own — the second copy is where extraction
	 * was due (CLAUDE.md §2).
	 */
	import type { Component } from 'svelte';
	import type { Snippet } from 'svelte';

	const styles = {
		container: 'min-h-screen  p-4 transition-colors duration-300 md:p-8',
		sectionWrapper: 'mx-auto max-w-305! grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3',

		// Card Styles
		card: 'rounded-lg border bg-card shadow-xs overflow-hidden',
		cardHeader: 'flex items-center gap-3 border-b px-5 py-3',
		cardContent: 'p-5',

		// Typography
		mainHeading: 'text-3xl text-cetner font-extrabold tracking-tight text-gray-900 dark:text-white',
		subHeading: 'mt-1 text-sm text-gray-500 dark:text-slate-400',
		sectionTitle: 'text-base font-semibold text-foreground',

		/*
		 * One neutral icon tile. The five variants were five colours — indigo, red, emerald, amber,
		 * slate — and are kept as names so callers keep compiling; colour on a card now means a
		 * warning, not a category.
		 */
		iconBox:
			'flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4',
		// Specific Icon Variants
		identityIcon: '',
		addressIcon: '',
		employmentIcon: '',
		personalIcon: '',
		systemIcon: ''
	};

	type Styles = 'identityIcon' | 'addressIcon' | 'employmentIcon' | 'personalIcon' | 'systemIcon';

	import type { IconProps } from '@lucide/svelte';
	let {
		title,
		IconComp,
		children,
		editDialog,
		style = 'identityIcon',
		class: className = ''
	}: {
		title: string;
		IconComp: Component<IconProps>;
		children: Snippet;
		editDialog?: Snippet;
		style: Styles;
		class?: string;
	} = $props();
</script>

<section class="{styles.card} {className}">
	<div class={styles.cardHeader}>
		<div class="{styles.iconBox} {styles[style]}"><IconComp /></div>
		<h4 class={styles.sectionTitle}>{title}</h4>
		{@render editDialog?.()}
	</div>
	<div class={styles.cardContent}>
		{@render children?.()}
	</div>
</section>
