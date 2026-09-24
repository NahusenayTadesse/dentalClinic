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

const STORE = process.env.FILES_DIR ?? 'files';
const SOURCE = join('static', 'newLogo.png');
const SEEDED = 'seedplaceholder0000000000.png';

/** The stored name of the placeholder, or null when there is nothing to copy. */
export function placeholderFile(): string | null {
	if (!existsSync(SOURCE)) return null;

	if (!existsSync(STORE)) mkdirSync(STORE, { recursive: true });

	const target = join(STORE, SEEDED);
	if (!readdirSync(STORE).includes(SEEDED)) copyFileSync(SOURCE, target);

	return SEEDED;
}
