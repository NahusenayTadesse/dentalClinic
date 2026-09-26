/**
 * The signed-in viewer's permissions, available to any component without threading a prop.
 *
 * A table cell is built by a column definition — a plain function with no component and no
 * `data` — so `permList` cannot reach it as a prop without passing it through every one of the
 * ~90 `columns.ts` files and the table between them. It is set once by the dashboard layout and
 * read wherever a mention has to decide whether to be a link.
 *
 * **Svelte context, deliberately, and not a module-level `$state`.** A module is shared by every
 * request the server handles, so a viewer-scoped value stored there is one concurrent request
 * away from being rendered for the wrong person — on a clinic server where the receptionist and
 * the dentist are both mid-page-load, that is not a remote possibility. Context is per component
 * tree, which is per request.
 *
 * Reading this decides *rendering* only. It is not a control and must never be used as one: the
 * control is the route gate in `hooks.server.ts`, and a form action's own
 * `requirePermission` (CLAUDE.md §9). Hiding a link is courtesy; refusing the request is
 * authorization.
 */
import { getContext, setContext } from 'svelte';

const KEY = Symbol.for('clinic.viewer');

type Viewer = { permList: string[] };

/** Called once, by the dashboard layout. Everything below it can then read the list. */
export function setViewer(get: () => string[] | undefined | null) {
	setContext<Viewer>(KEY, {
		get permList() {
			return get() ?? [];
		}
	});
}

/**
 * The viewer's permissions, or an empty list outside a dashboard tree.
 *
 * Empty is the safe default: every mention renders as plain text rather than as a link nobody
 * can follow. A component used outside the layout degrades to showing names, not to throwing.
 */
export function viewerPermissions(): string[] {
	return getContext<Viewer | undefined>(KEY)?.permList ?? [];
}

/**
 * The viewer itself, for reading `permList` inside a `$derived` so it follows the layout's data.
 *
 * `viewerPermissions()` returns the list as it is at the moment of the call, which is right for a
 * table cell rendered once and wrong for a menu that must change when the data does. This hands
 * back the getter instead. Call it during component setup, as with any context.
 */
export function viewer(): { readonly permList: string[] } {
	return getContext<Viewer | undefined>(KEY) ?? { permList: [] };
}
