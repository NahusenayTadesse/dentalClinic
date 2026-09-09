import type { HelpEntry } from '$lib/types/types';

// Every JSON file in ./content is picked up at build time. Add a file, get help.
const modules = import.meta.glob('./content/**/*.json', {
	eager: true,
	import: 'default'
}) as Record<string, HelpEntry>;

const exact = new Map<string, HelpEntry>();
const partial: HelpEntry[] = [];

for (const [file, entry] of Object.entries(modules)) {
	if (entry.path) {
		exact.set(normalize(entry.path), entry);
	} else if (entry.match) {
		partial.push(entry);
	} else if (import.meta.env.DEV) {
		console.warn(`[help] ${file} has neither "path" nor "match" and will never show.`);
	}
}

// Longest match wins, so "/invoices/edit/" beats "/invoices/".
partial.sort((a, b) => b.match!.length - a.match!.length);

function normalize(pathname: string) {
	return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function resolveHelp(pathname: string): HelpEntry | undefined {
	const p = normalize(pathname);
	return exact.get(p) ?? partial.find((e) => p.includes(e.match!));
}