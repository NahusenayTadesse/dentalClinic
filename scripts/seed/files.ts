/**
 * One real file in the store, so seeded attachments open instead of 404ing.
 *
 * `patient_file` and the employee document columns hold a stored name that `server/files.ts` owns;
 * a made-up name would look right in a list and fail on click, which teaches the wrong thing about
 * the file route. This copies a placeholder in under a name of the shape the app generates
 * (CLAUDE.md §10 — the stored name is opaque, and only its shape is imitated here).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// The same fallback as `server/files.ts`. It was `'files'` here, so with the variable unset the
// seed filled one directory and the app served from another.
const STORE = process.env.FILES_DIR ?? '.tempFiles';
const SOURCE = join('static', 'newLogo.png');

/**
 * Stored names for `count` placeholder files, each its own copy, or an empty list when there is
 * nothing to copy. One copy per row, not one shared name: a stored name is how the file route
 * finds the patient a file belongs to, and sixty rows sharing one name would all resolve to the
 * first patient.
 */
export function placeholderFiles(count: number): string[] {
	if (!existsSync(SOURCE)) return [];
	if (!existsSync(STORE)) mkdirSync(STORE, { recursive: true });

	const present = new Set(readdirSync(STORE));
	return Array.from({ length: count }, (_, i) => {
		const name = `seedplaceholder${String(i).padStart(10, '0')}.png`;
		if (!present.has(name)) copyFileSync(SOURCE, join(STORE, name));
		return name;
	});
}
