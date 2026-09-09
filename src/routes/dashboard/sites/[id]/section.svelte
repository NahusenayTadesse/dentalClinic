<script lang="ts">
	import type { Component } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PageData } from './$types';

	const styles = {
		container: 'min-h-screen  p-4 transition-colors duration-300 md:p-8',
		sectionWrapper: 'mx-auto max-w-305! grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3',

		// Card Styles
		card: 'rounded-2xl border shadow-lg bg-accent transition-all overflow-hidden',
		cardHeader: 'flex items-center gap-3 border-b border-background px-6 py-4',
		cardContent: 'p-6',

		// Typography
		mainHeading: 'text-3xl text-cetner font-extrabold tracking-tight text-gray-900 dark:text-white',
		subHeading: 'mt-1 text-sm text-gray-500 dark:text-slate-400',
		sectionTitle: 'text-lg font-bold text-gray-800 dark:text-slate-100',

		// Icon Styles
		iconBox: 'flex gap-4  h-10 w-10 items-center justify-center rounded-lg',
		// Specific Icon Variants
		identityIcon: 'bg-indigo-100  text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
		addressIcon: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
		employmentIcon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
		personalIcon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
		systemIcon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
