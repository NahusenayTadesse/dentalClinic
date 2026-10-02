/**
 * Filling `{name}`-style placeholders in text a clinic writes itself — an SMS reminder, a consent
 * form. Client-safe, so the screen that edits a template previews exactly what will be sent or
 * printed.
 *
 * A known placeholder with no value is left out rather than printed as `{phone}`; an unknown
 * `{word}` is left as written, so a typo shows in the preview instead of vanishing. Line breaks
 * are kept — a consent form is paragraphs — and only runs of spaces left by an empty value close up.
 */
export function fillPlaceholders<K extends string>(
	template: string,
	values: Partial<Record<K, string | null>>,
	known: readonly K[]
): string {
	const isKnown = (key: string): key is K => (known as readonly string[]).includes(key);
	return template
		.replace(/\{(\w+)\}/g, (whole, key: string) => (isKnown(key) ? (values[key] ?? '') : whole))
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/[ \t]+$/gm, '')
		.trim();
}
