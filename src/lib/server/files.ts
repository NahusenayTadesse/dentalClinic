import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from '$env/dynamic/private';

import { generateFileName } from '$lib/global.svelte';

/**
 * Everything the app knows about stored files: where they live, what they may be, and how to
 * reach one safely.
 *
 * Uploading and serving used to each carry their own copy of this. They disagreed — the two
 * `FILES_DIR` fallbacks were `.tempFiles` and `.temp-files`, so with the variable unset a file
 * was written to one directory and looked for in another — and the serving side's MIME table
 * was missing formats the upload side accepted, so an iPhone photo downloaded as a binary blob
 * instead of displaying.
 *
 * The files here are patient- and staff-identifying: identity documents, contracts, receipts,
 * and in time radiographs. Several rules below are about that rather than about tidiness.
 */

/** Where uploads are written. One definition, so the two ends cannot disagree again. */
export const FILES_DIR = env.FILES_DIR ?? '.tempFiles';

/** Created once, at module load, so neither end has to check on every request. */
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

/**
 * The largest upload accepted, enforced **server-side**.
 *
 * The zod schemas check the same figure in the browser. That check is a courtesy to the person
 * filling the form; this one is the control, because a form action is reachable by anyone who
 * can POST to it.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Extension → content type. The upload side accepts every format listed here, and no others. */
const MIME_BY_EXTENSION = {
	// documents
	pdf: 'application/pdf',
	txt: 'text/plain',
	csv: 'text/csv',
	// images
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	avif: 'image/avif',
	// iOS photographs. Accepted on upload, and previously served as a binary download
	// because the serving table had never been told about them.
	heic: 'image/heic',
	heif: 'image/heif',
	// media
	mp3: 'audio/mpeg',
	mp4: 'video/mp4',
	webm: 'video/webm'
} as const;

/** The content types an upload may claim. Derived, so the two lists cannot drift. */
const ACCEPTED_MIME_TYPES = new Set<string>(Object.values(MIME_BY_EXTENSION));

/** Content type for a stored name. Unknown extensions download rather than render. */
export function mimeFor(fileName: string): string {
	const ext = fileName.toLowerCase().split('.').at(-1) ?? '';
	return MIME_BY_EXTENSION[ext as keyof typeof MIME_BY_EXTENSION] ?? 'application/octet-stream';
}

/**
 * The absolute path of a stored file, or `null` if the name does not name one.
 *
 * The containment check is the point. `path.normalize` alone resolves `..` rather than
 * rejecting it, so a request for `..` used to yield the directory *above* the store. Routing
 * made that hard to exploit — a `[name]` parameter never matches a literal `/` — but that is a
 * property of the router, not a decision this module made, and it would evaporate the moment
 * the route were mounted somewhere else.
 */
export function resolveStoredFile(name: string): string | null {
	const root = path.resolve(FILES_DIR);
	const target = path.resolve(root, name);

	// `startsWith(root)` alone would also accept a sibling directory named `filesX`.
	if (target !== root && !target.startsWith(root + path.sep)) return null;
	if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return null;

	return target;
}

/**
 * Writes an uploaded file to the store and returns the name to put in the database.
 *
 * The name is 122 bits of randomness, which is doing real work: `/dashboard/files/[name]` can
 * only check that the caller is signed in, so an unguessable name is what stops one person's
 * documents being found by trying another's. See the note on that route.
 */
export async function saveUploadedFile(file: File | undefined): Promise<string> {
	// Was dereferenced unguarded — the signature admitted `undefined` and the body assumed
	// otherwise, so a missing file threw a TypeError from inside the stream plumbing.
	if (!file || file.size === 0) {
		throw new Error('No file was uploaded.');
	}

	if (file.size > MAX_UPLOAD_BYTES) {
		throw new Error(`That file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`);
	}

	// The extension decides how the file is served later, so it is taken from the browser's
	// declared type rather than from the filename, which the client also chooses but which
	// nothing downstream validates.
	const declared = file.type?.toLowerCase() ?? '';
	if (!ACCEPTED_MIME_TYPES.has(declared)) {
		throw new Error('That file type is not accepted.');
	}

	const ext =
		Object.entries(MIME_BY_EXTENSION).find(([, mime]) => mime === declared)?.[0] ??
		path.extname(file.name).replace('.', '').toLowerCase();

	const fileName = `${generateFileName()}.${ext}`;
	const target = path.join(FILES_DIR, fileName);

	// `File.stream()` is a DOM ReadableStream; Node's typings for `fromWeb` want its own
	// structurally-identical one, and the two do not line up on the generic parameter.
	const source = Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]);

	await pipeline(source, fs.createWriteStream(target));

	return fileName;
}
