/**
 * How a radiograph is being looked at: zoom, where it has been dragged to, and the adjustments a
 * dentist makes to read a dark film. One object, so two panes can share it — "move together" is
 * both panes holding the same one, which keeps a region lined up across two years of films.
 */
export type View = {
	zoom: number;
	x: number;
	y: number;
	/** Percent, 100 as taken. */
	brightness: number;
	contrast: number;
	invert: boolean;
	/** Quarter turns, for a film exported on its side. */
	turns: number;
};

/** The film as taken, fitted to its pane. */
export function freshView(): View {
	return { zoom: 1, x: 0, y: 0, brightness: 100, contrast: 100, invert: false, turns: 0 };
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

/** A zoom kept inside its limits. */
export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
