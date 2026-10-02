<script lang="ts">
	import type { Component } from 'svelte';
	import type { IconProps } from '@lucide/svelte';
	import * as Tooltip from '@nahu/admin-kit/components/ui/tooltip/index.js';
	import { Button, type ButtonVariant } from '@nahu/admin-kit/components/ui/button/index.js';
	import { buttonVariants } from '@nahu/admin-kit/components/ui/button/index.js';
	import { entityHref, type EntityKind } from '$lib/entityLinks';
	import { viewerPermissions } from '$lib/viewer.svelte';

	/**
	 * A mention of a record, as a link when the viewer may open it.
	 *
	 * Two ways to call it, and new code should use the first:
	 *
	 *   `entity` + `id`  — resolves the path from `$lib/entityLinks` and renders plain text when
	 *                      the viewer may not open the target. This is the one that makes the app
	 *                      read like the database: a foreign key the viewer can follow becomes a
	 *                      way to get there, and one they cannot stops advertising a page that
	 *                      would 403 (CLAUDE.md §9).
	 *   `link` + `id`    — the original form, an explicit href. Still here because 71 call sites
	 *                      use it and because some targets are not records at all (a stored file).
	 *                      It does no permission check, so prefer `entity` for anything that is a
	 *                      row in a table.
	 *
	 * `display` is for mentions outside a table — prose, a detail panel — where the button
	 * styling is wrong but the linking rule is the same.
	 */
	let {
		id,
		IconComp,
		name,
		link,
		entity,
		display = 'button',
		variant = 'ghost',
		target = ''
	}: {
		/**
		 * Appended to `link` (or to the entity's base path) to build the href. Numeric because most
		 * tables here are keyed by an autoincrement `int` — only `user` uses a string id — and the
		 * value is interpolated into a URL either way.
		 */
		id: string | number | null;
		name: string | null;
		/** An explicit href. Mutually exclusive with `entity`; `entity` wins if both are given. */
		link?: string;
		/** The kind of record this names. Resolves its own path and checks the viewer's access. */
		entity?: EntityKind;
		display?: 'button' | 'inline';
		target?: string;
		IconComp?: Component<IconProps>;
		variant?: ButtonVariant;
	} = $props();

	const permList = viewerPermissions();

	/*
	 * Null means "render the name, not a link" — because there is no id, because the viewer may
	 * not open it, or because no href was supplied at all. The caller does the same thing in
	 * every one of those cases, so they collapse into one value.
	 */
	let href = $derived(
		entity ? entityHref(entity, id, permList) : id === null || !link ? null : `${link}/${id}`
	);
</script>

{#if !href}
	<!-- Plain text, deliberately: a link the viewer cannot open lands on a 403 and tells them a
	     page exists that they were not meant to know about. -->
	<span class="wrap-break-words inline-flex items-center gap-2">
		{#if IconComp}
			<IconComp class="size-4" />
		{/if}
		{name}
	</span>
{:else if display === 'inline'}
	<a {href} {target} class="underline underline-offset-2 hover:no-underline">
		{#if IconComp}
			<IconComp class="inline size-4" />
		{/if}
		{name}
	</a>
{:else}
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger class={buttonVariants({ variant: 'ghost' })}>
				{#snippet child({ props })}
					<Button
						{href}
						{target}
						{variant}
						{...props}
						class="wrap-break-words items-end! justify-start!  {variant === 'ghost' ? 'pl-0' : ''}"
					>
						{#if IconComp}
							<IconComp class="size-4" />
						{/if}
						{name}
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content class="left-0 justify-self-start">
				<p class="text-[13px]!">Goto {name}</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
{/if}
