<script lang="ts">
	import { page } from '$app/state';
	import CircleQuestionMark from '@lucide/svelte/icons/circle-question-mark';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import * as Sheet from '@nahu/admin-kit/components/ui/sheet/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Separator } from '@nahu/admin-kit/components/ui/separator/index.js';
	import { resolveHelp } from '$lib/Registry';

	let open = $state(false);
	let language = $state<'en' | 'am'>('en');

	const entry = $derived(resolveHelp(page.url.pathname));

	const displayEntry = $derived.by(() => {
		if (!entry) return null;

		const rawEntry = entry as any;
		if (rawEntry.languages && rawEntry.languages[language]) {
			return rawEntry.languages[language];
		}
		return entry;
	});

	/**
	 * Where "See more" goes: the chapter of the help centre this screen belongs to,
	 * which every entry names in its own links. Falls back to the top of the help
	 * centre for an entry that names none, so the button is always useful.
	 */
	const seeMoreHref = $derived(
		(displayEntry?.links ?? []).find((link: { href: string }) =>
			link.href.startsWith('/dashboard/help')
		)?.href ?? '/dashboard/help'
	);

	// The guide link is the "See more" button now, so listing it again below the
	// sections would just be the same link twice.
	const extraLinks = $derived(
		(displayEntry?.links ?? []).filter(
			(link: { href: string }) => !link.href.startsWith('/dashboard/help')
		)
	);

	// Close the panel when the route changes, so it never explains the wrong page.
	$effect(() => {
		page.url.pathname;
		open = false;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return;
		const t = e.target as HTMLElement | null;
		if (t?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName ?? '')) return;
		e.preventDefault();
		open = !open;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<Sheet.Root bind:open>
	<Sheet.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				size="icon"
				variant="default"
				aria-label="Help for this page"
				title="Help for this page (?)"
				class="size-11 rounded-full border shadow-lg"
			>
				<CircleQuestionMark class="size-5" />
			</Button>
		{/snippet}
	</Sheet.Trigger>

	<Sheet.Content side="right" class="flex w-full flex-col gap-0 sm:max-w-md">
		<Sheet.Header class="flex items-start justify-between gap-1">
			<div class="space-y-1">
				<Sheet.Title>{displayEntry?.title ?? 'Help'}</Sheet.Title>
				{#if displayEntry?.summary}
					<Sheet.Description>{displayEntry.summary}</Sheet.Description>
				{:else}
					<Sheet.Description>
						This screen has no page-specific note yet — the help centre covers it.
					</Sheet.Description>
				{/if}
			</div>
			{#if entry}
				<div class="flex gap-1">
					<button
						onclick={() => (language = 'en')}
						class="rounded px-2 py-1 text-xs font-medium transition-colors {language === 'en'
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
					>
						EN
					</button>
					<button
						onclick={() => (language = 'am')}
						class="rounded px-2 py-1 text-xs font-medium transition-colors {language === 'am'
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
					>
						አ
					</button>
				</div>
			{/if}
		</Sheet.Header>

		<div class="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
			{#if !entry}
				<p class="text-sm leading-relaxed text-muted-foreground">
					Nobody has written a note for this particular screen yet. The help centre explains every
					screen in the system, the workflow behind it and the permission it sits behind — and it is
					searchable.
				</p>
			{/if}

			{#each displayEntry?.sections ?? [] as section (section.heading)}
				<section class="space-y-1.5">
					<h3 class="text-sm! font-medium">{section.heading}</h3>
					<p class="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
						{section.body}
					</p>
				</section>
			{/each}

			{#if extraLinks.length}
				<Separator />
				<nav class="space-y-2">
					{#each extraLinks as link (link.href)}
						<a
							href={link.href}
							class="flex items-center gap-1.5 text-sm text-primary hover:underline"
						>
							{link.label}
							<ExternalLink class="size-3.5" />
						</a>
					{/each}
				</nav>
			{/if}
		</div>

		<Sheet.Footer class="gap-3 border-t">
			<Button href={seeMoreHref} variant="secondary" class="w-full">
				See more
				<ArrowRight class="size-4" />
			</Button>
			<p class="text-xs text-muted-foreground">
				Opens this screen's chapter in the help centre. Press
				<kbd class="rounded border bg-muted px-1 font-mono">?</kbd> anywhere to open this panel.
			</p>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>
