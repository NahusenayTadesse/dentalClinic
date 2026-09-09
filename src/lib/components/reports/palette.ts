/**
 * The chart palette, one validated set per theme.
 *
 * The eight hues are assigned to series in this fixed order and never cycled —
 * a chart's fourth series is always the fourth colour, so a filter that removes
 * a series does not repaint the ones that remain. Both orderings clear the
 * colourblind-separation and lightness gates against their own surface; the
 * dark column is the same eight hues re-stepped for a dark background, not an
 * automatic inversion of the light one.
 */
export const SERIES_LIGHT = [
	'#2a78d6', // blue
	'#eb6834', // orange
	'#1baf7a', // aqua
	'#eda100', // yellow
	'#e87ba4', // magenta
	'#008300', // green
	'#4a3aa7', // violet
	'#e34948' // red
];

export const SERIES_DARK = [
	'#3987e5',
	'#d95926',
	'#199e70',
	'#c98500',
	'#d55181',
	'#008300',
	'#9085e9',
	'#e66767'
];

/** Ink and surface tokens, so marks sit on a known background in either theme. */
export const THEME = {
	light: {
		series: SERIES_LIGHT,
		surface: '#fcfcfb',
		text: '#0b0b0b',
		muted: '#52514e',
		grid: 'rgba(11, 11, 11, 0.08)'
	},
	dark: {
		series: SERIES_DARK,
		surface: '#1a1a19',
		text: '#f5f5f4',
		muted: '#c3c2b7',
		grid: 'rgba(245, 245, 244, 0.10)'
	}
} as const;

export type ThemeName = keyof typeof THEME;

/** Hex plus an alpha byte — used for area fills under a line. */
export function fade(hex: string, alpha: number): string {
	const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
		.toString(16)
		.padStart(2, '0');
	return `${hex}${byte}`;
}
