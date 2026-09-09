export type HelpLink = {
	label: string;
	href: string;
};

export type HelpSection = {
	heading: string;
	/** Plain text. Blank lines are preserved. */
	body: string;
};

export type HelpEntry = {
	/** Exact match: page.url.pathname === path */
	path?: string;
	/** Substring match: page.url.pathname.includes(match). Use for dynamic routes. */
	match?: string;
	title: string;
	summary?: string;
	sections?: HelpSection[];
	links?: HelpLink[];
};
