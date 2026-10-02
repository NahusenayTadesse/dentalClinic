import { describe, expect, it } from 'vitest';
import { APPROVAL_QUEUES, NAVIGATION, SETTINGS_SECTIONS, searchEntries } from '$lib/navigation';
import { MESSAGES } from './messages';
import { isLang } from './lang';

/** Every string a messages object can produce, with sample values for the ones that take some. */
function strings(value: unknown, path = ''): [string, string][] {
	if (typeof value === 'string') return [[path, value]];
	if (typeof value === 'function') {
		const out: unknown = value(...Array.from({ length: value.length }, (_, i) => i + 2));
		return typeof out === 'string' ? [[path, out]] : [];
	}
	if (value && typeof value === 'object') {
		return Object.entries(value).flatMap(([key, v]) => strings(v, path ? `${path}.${key}` : key));
	}
	return [];
}

describe('Amharic messages', () => {
	it('gives every menu title an Amharic name', () => {
		const titles = new Set<string>([
			...NAVIGATION.flatMap((group) => [group.title, ...(group.items ?? []).map((i) => i.title)]),
			...APPROVAL_QUEUES.map((q) => q.title),
			...SETTINGS_SECTIONS.map((s) => s.title),
			...searchEntries(() => true).flatMap((e) => e.label.split(' › '))
		]);
		const missing = [...titles].filter((title) => !MESSAGES.am.nav[title]);
		expect(missing, 'Add these to i18n/messages/am/nav.ts').toEqual([]);
	});

	it('leaves no Amharic message empty or with a value unfilled', () => {
		const bad = strings(MESSAGES.am).filter(
			([, text]) => text.trim() === '' || text.includes('${') || text.includes('undefined')
		);
		expect(bad).toEqual([]);
	});

	it('reads only the languages it speaks from a cookie', () => {
		expect(isLang('am')).toBe(true);
		expect(isLang('en')).toBe(true);
		expect(isLang('fr')).toBe(false);
		expect(isLang(undefined)).toBe(false);
	});
});
