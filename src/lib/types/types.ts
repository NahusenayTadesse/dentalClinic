export type HelpLink = {
	label: string;
	href: string;
};

export type HelpSection = {
	heading: string;
	/** Plain text. Blank lines are preserved. */
	body: string;
};

/** What the help panel shows for a screen, in one language. */
export type HelpContent = {
	title: string;
	summary?: string;
	sections?: HelpSection[];
	links?: HelpLink[];
};

/**
 * One `$lib/content/*.json` file: where it applies, and its text in each language. Every file
 * carries `languages`; the panel falls back to English for a language a file lacks.
 */
export type HelpEntry = {
	/** Exact match: page.url.pathname === path */
	path?: string;
	/** Substring match: page.url.pathname.includes(match). Use for dynamic routes. */
	match?: string;
	languages: { en: HelpContent; am?: HelpContent };
};
