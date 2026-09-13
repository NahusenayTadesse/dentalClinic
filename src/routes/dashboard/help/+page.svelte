<script lang="ts">
	import { tick } from 'svelte';
	import {
		Search,
		Download,
		LifeBuoy,
		ChevronDown,
		X,
		Rocket,
		BadgeCheck,
		Building2,
		Banknote,
		IdCardLanyard,
		Coins,
		Container,
		ChartArea,
		UserRoundCog,
		CircleHelp,
		Route,
		Lock,
		ArrowUpRight
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index';
	import { Input } from '$lib/components/ui/input/index';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		HELP_SECTIONS,
		ALL_TOPICS,
		TOPIC_COUNT,
		ROUTE_MAP,
		ROUTE_COUNT,
		searchIndex,
		routeSearchIndex,
		isNavigable,
		openFrom,
		type RouteEntry
	} from '$lib/help/content';
	import RichText from '$lib/help/rich-text.svelte';
	import { printManual } from '$lib/help/manual';
	import { canVisit } from '$lib/routeAccess';

	// Comes down from the dashboard layout, and is the same list the server gate and
	// the sidebar read — so the map never offers a link the click would refuse.
	let { data } = $props();

	let query = $state('');
	let open = $state<Record<string, boolean>>({});
	let downloading = $state(false);

	const sectionIcons: Record<string, typeof Rocket> = {
		start: Rocket,
		approvals: BadgeCheck,
		commercial: Building2,
		billing: Banknote,
		people: IdCardLanyard,
		finance: Coins,
		supplies: Container,
		reports: ChartArea,
		admin: UserRoundCog,
		questions: CircleHelp
	};

	// Built once, not per keystroke: the haystack for a topic never changes, only
	// the needle does.
	const topicHaystacks = ALL_TOPICS.map((topic) => ({ topic, text: searchIndex(topic) }));
	const routeHaystacks = ROUTE_MAP.map((route) => ({ route, text: routeSearchIndex(route) }));

	const needle = $derived(query.trim().toLowerCase());

	const matches = $derived(
		needle
			? new Set(topicHaystacks.filter((h) => h.text.includes(needle)).map((h) => h.topic.id))
			: null
	);

	const visibleRoutes = $derived(
		needle ? routeHaystacks.filter((h) => h.text.includes(needle)).map((h) => h.route) : ROUTE_MAP
	);

	const matchCount = $derived((matches ? matches.size : TOPIC_COUNT) + visibleRoutes.length);

	// A section disappears entirely when nothing in it matches, so the page never
	// becomes a list of empty headings.
	const visibleSections = $derived(
		HELP_SECTIONS.map((section) => ({
			...section,
			Icon: sectionIcons[section.id] ?? CircleHelp,
			topics: section.topics.filter((topic) => !matches || matches.has(topic.id))
		})).filter((section) => section.topics.length > 0)
	);

	// Routes are grouped for reading, and the grouping follows whatever survived
	// the search rather than the full list.
	const visibleRouteGroups = $derived(
		[...new Set(visibleRoutes.map((route) => route.group))].map((group) => ({
			group,
			routes: visibleRoutes.filter((route) => route.group === group)
		}))
	);

	// While searching, every match is already open — hunting through collapsed
	// results would defeat the search.
	//
	// Both halves are coerced: `open[id]` is undefined until a row has been
	// touched, and Svelte drops an attribute set to undefined, which would leave
	// aria-expanded missing entirely on every untouched row.
	const isOpen = (id: string) => Boolean(matches) || Boolean(open[id]);

	function toggle(id: string) {
		if (matches) return;
		open[id] = !open[id];
	}

	function expandAll(value: boolean) {
		open = value ? Object.fromEntries(ALL_TOPICS.map((t) => [t.id, true])) : {};
	}

	/**
	 * What the Address cell should offer for one route: a link straight to the
	 * screen, or an honest explanation of why there isn't one.
	 *
	 * Three reasons a row is not a link: the address stands for one particular
	 * record (`[id]`), the address is an action rather than a screen (the backup
	 * download), or this user does not hold the permission — and a link that 403s
	 * is worse than no link at all.
	 */
	function routeLink(route: RouteEntry) {
		const allowed = canVisit(route.path, data?.permList);

		if (!allowed) {
			return { note: 'You do not hold this permission.', locked: true };
		}

		if (isNavigable(route)) {
			return { href: route.path };
		}

		if (route.nonNavigable) {
			return { note: 'Runs when opened — not a screen to browse.' };
		}

		const parent = openFrom(route);
		const reachable = parent && canVisit(parent.path, data?.permList) ? parent : undefined;

		return reachable
			? {
					note: 'Stands for one record. Open it from',
					viaHref: reachable.path,
					viaLabel: reachable.title.toLowerCase()
				}
			: { note: 'Stands for one record — reached from a list, not typed in.' };
	}

	async function jumpTo(id: string) {
		query = '';
		await tick();
		document
			.getElementById(`section-${id}`)
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	/**
	 * Hands the manual to the browser's print dialog, where "Save as PDF" writes
	 * the file — the same route every table export in this app takes.
	 */
	async function downloadManual() {
		downloading = true;
		try {
			await printManual();
		} finally {
			downloading = false;
		}
	}
</script>

<svelte:head>
	<title>Help</title>
</svelte:head>

<div class="flex flex-col gap-6 pb-16">
	<!-- Header -->
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="space-y-1">
			<h1 class="flex items-center gap-2 text-left! text-2xl! font-semibold">
				<LifeBuoy class="size-6 text-primary" /> Help
			</h1>
			<p class="max-w-[70ch] text-sm text-muted-foreground">
				Every screen in this system, explained — what it does, what happens when you use it, and
				what it sits behind. Search for what you are trying to do, or browse the sections below.
			</p>
		</div>

		<div class="flex flex-col items-end gap-2">
			<Button onclick={downloadManual} disabled={downloading}>
				<Download class="size-4" />
				{downloading ? 'Preparing…' : 'Download the manual'}
			</Button>
			<p class="text-xs text-muted-foreground">Built and maintained by amno ERP Solutions</p>
		</div>
	</div>

	<!-- Search -->
	<div class="flex flex-col gap-3">
		<div class="relative">
			<Search
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				type="search"
				bind:value={query}
				placeholder="Search — try “payroll”, “VAT”, “approve”, “lease”, “add a customer”, “/dashboard/reports”…"
				class="h-11 pr-10 pl-9"
				aria-label="Search the help"
			/>
			{#if query}
				<button
					type="button"
					onclick={() => (query = '')}
					aria-label="Clear the search"
					class="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<X class="size-4" />
				</button>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if needle}
				<Badge variant={matchCount ? 'secondary' : 'destructive'}>
					{matchCount}
					{matchCount === 1 ? 'result' : 'results'} for “{query.trim()}”
				</Badge>
				<Button variant="ghost" size="sm" onclick={() => (query = '')}>Show everything</Button>
			{:else}
				<Badge variant="secondary">{TOPIC_COUNT} topics</Badge>
				<Badge variant="secondary">{ROUTE_COUNT} routes</Badge>
				<Button variant="ghost" size="sm" onclick={() => expandAll(true)}>Expand all</Button>
				<Button variant="ghost" size="sm" onclick={() => expandAll(false)}>Collapse all</Button>
			{/if}
		</div>
	</div>

	<!-- Jump links -->
	{#if !needle}
		<nav class="flex flex-wrap gap-2" aria-label="Jump to a section">
			{#each HELP_SECTIONS as section (section.id)}
				<Button variant="outline" size="sm" onclick={() => jumpTo(section.id)}>
					{section.title}
				</Button>
			{/each}
			<Button variant="outline" size="sm" onclick={() => jumpTo('routes')}>Route map</Button>
		</nav>
	{/if}

	<!-- Nothing matched -->
	{#if visibleSections.length === 0 && visibleRoutes.length === 0}
		<div class="rounded-xl border border-dashed p-10 text-center">
			<p class="font-semibold">Nothing matches “{query.trim()}”.</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Try a plainer word — “salary”, “stock”, “approve”, “bank”, “leave”. The search reads every
				word of every answer and every route, not just the headings.
			</p>
		</div>
	{/if}

	<!-- Sections -->
	{#each visibleSections as section (section.id)}
		<section id="section-{section.id}" class="scroll-mt-6">
			<div class="mb-3 flex items-start gap-3 border-b pb-2">
				<span
					class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
				>
					<section.Icon class="size-4" />
				</span>
				<div>
					<h2 class="text-base! font-semibold">{section.title}</h2>
					<p class="max-w-[75ch] text-sm text-muted-foreground">{section.blurb}</p>
				</div>
			</div>

			<div class="flex flex-col divide-y rounded-xl border">
				{#each section.topics as topic (topic.id)}
					<div>
						<button
							type="button"
							onclick={() => toggle(topic.id)}
							aria-expanded={isOpen(topic.id)}
							class="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50"
						>
							<div class="min-w-0 flex-1">
								<p class="font-semibold">{topic.title}</p>
								<p class="text-sm text-muted-foreground"><RichText text={topic.summary} /></p>
							</div>
							{#if !matches}
								<ChevronDown
									class="mt-1 size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none {isOpen(
										topic.id
									)
										? 'rotate-180'
										: ''}"
								/>
							{/if}
						</button>

						{#if isOpen(topic.id)}
							<div class="flex flex-col gap-3 px-4 pt-1 pb-5 text-sm">
								{#if topic.where}
									<p class="text-xs">
										<span
											class="mr-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
										>
											Where
										</span>
										<span class="font-medium text-primary"><RichText text={topic.where} /></span>
									</p>
								{/if}

								{#if topic.permission}
									<p class="flex items-start gap-2 text-xs text-muted-foreground">
										<Lock class="mt-0.5 size-3 shrink-0" />
										<span>Needs <RichText text={topic.permission} /></span>
									</p>
								{/if}

								{#if topic.steps?.length}
									<ol class="ml-5 list-decimal space-y-1.5 marker:text-muted-foreground">
										{#each topic.steps as step, i (i)}
											<li class="pl-1"><RichText text={step} /></li>
										{/each}
									</ol>
								{/if}

								{#if topic.notes?.length}
									<ul
										class="ml-5 list-disc space-y-1.5 text-muted-foreground marker:text-primary/50"
									>
										{#each topic.notes as note, i (i)}
											<li class="pl-1"><RichText text={note} /></li>
										{/each}
									</ul>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/each}

	<!-- Route map -->
	{#if visibleRouteGroups.length > 0}
		<section id="section-routes" class="scroll-mt-6">
			<div class="mb-3 flex items-start gap-3 border-b pb-2">
				<span
					class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
				>
					<Route class="size-4" />
				</span>
				<div>
					<h2 class="text-base! font-semibold">The route map</h2>
					<p class="max-w-[75ch] text-sm text-muted-foreground">
						Every address in the system, what it is for, and the permission it sits behind. A route
						with no permission listed is open to any signed-in user. Parts in square brackets stand
						for a record — <code class="rounded bg-muted px-1 font-mono text-xs">[id]</code> is a particular
						customer, employee or contract.
					</p>
				</div>
			</div>

			<div class="flex flex-col gap-6">
				{#each visibleRouteGroups as { group, routes } (group)}
					<div class="overflow-hidden rounded-xl border">
						<h3 class="border-b bg-muted/50 px-4 py-2 text-sm! font-semibold">{group}</h3>
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr
										class="border-b text-left text-xs tracking-wider text-muted-foreground uppercase"
									>
										<th class="px-4 py-2 font-medium">Address</th>
										<th class="px-4 py-2 font-medium">What it is for</th>
										<th class="px-4 py-2 font-medium">Permission</th>
									</tr>
								</thead>
								<tbody class="divide-y">
									{#each routes as route (route.path)}
										{@const link = routeLink(route)}
										<tr class="align-top hover:bg-muted/40">
											<td class="px-4 py-3">
												{#if link.href}
													<a
														href={link.href}
														class="font-mono text-xs break-all text-primary hover:underline"
													>
														{route.path}
														<ArrowUpRight class="inline size-3 shrink-0 align-[-1px]" />
													</a>
												{:else}
													<code class="font-mono text-xs break-all text-muted-foreground">
														{route.path}
													</code>
												{/if}
												<span class="block text-xs text-muted-foreground">{route.title}</span>
												{#if link.note}
													<span class="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
														{#if link.locked}
															<Lock class="mt-0.5 size-3 shrink-0" />
														{/if}
														<span>
															{link.note}
															{#if link.viaHref}
																<a href={link.viaHref} class="text-primary hover:underline">
																	{link.viaLabel}
																</a>
															{/if}
														</span>
													</span>
												{/if}
											</td>
											<td class="px-4 py-3 text-muted-foreground">{route.purpose}</td>
											<td class="px-4 py-3">
												{#if route.permission}
													<code class="font-mono text-xs break-all">{route.permission}</code>
												{:else}
													<span class="text-xs text-muted-foreground">Any signed-in user</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<p class="pt-2 text-xs text-muted-foreground">
		Can't find it? The manual covers the same ground in one document — press
		<strong class="font-semibold">Download the manual</strong> at the top, then choose "Save as PDF"
		in the print dialog. Press
		<kbd class="rounded border bg-muted px-1 font-mono">?</kbd> on any screen for help about that screen
		alone.
	</p>
</div>
