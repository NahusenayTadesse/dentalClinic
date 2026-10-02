import fs from 'node:fs';
import { copyFile, open, readdir, rename, stat } from 'node:fs/promises';
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

/**
 * A stored file as an HTTP response: streamed, never read whole into memory, with a validator so a
 * repeat fetch is a 304. Shared by the file route and the radiograph inbox's previews, which used
 * to be one route's private code.
 *
 * `immutable` is for the store, where a name never changes what it holds. The inbox is a folder a
 * machine writes into, where it can — so its files are not cached at all.
 */
export function fileResponse(
	filePath: string,
	request: Request,
	caching: 'immutable' | 'none' = 'immutable'
): Response {
	const stats = fs.statSync(filePath);
	const etag = `W/"${stats.size}-${stats.mtime.getTime()}"`;

	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304 });
	}

	const stream = Readable.toWeb(fs.createReadStream(filePath), {
		/*
		 * Bounded queuing, because the server this runs on has 2GB of RAM and shares it.
		 *
		 * Without a strategy the web-stream wrapper will happily read ahead of a slow consumer,
		 * and a handful of concurrent downloads on a slow connection is exactly the shape that
		 * turns into resident memory. Node's own issue on this is nodejs/node#46347.
		 */
		strategy: new CountQueuingStrategy({ highWaterMark: 100 })
	});

	return new Response(stream as unknown as ReadableStream, {
		headers: {
			ETag: etag,
			'Content-Type': mimeFor(filePath),
			'Content-Length': String(stats.size),
			/*
			 * `private` is the load-bearing word. These are identity documents and clinical
			 * attachments; without it a shared proxy is entitled to keep a copy and hand it to
			 * the next person who asks.
			 *
			 * `immutable`, and a year, because a stored file genuinely cannot change: the name is
			 * 122 bits of randomness, and replacing an attachment writes a *new* name and points
			 * the row at that. There is nothing at this URL to revalidate, so a conditional
			 * request would spend a round trip being told what it already knows — which on the
			 * connections this is used over is most of the cost of the request.
			 */
			'Cache-Control':
				caching === 'immutable' ? 'private, max-age=31536000, immutable' : 'private, no-store',
			'Last-Modified': stats.mtime.toUTCString(),
			// Nothing here is meant to be interpreted as markup by the browser.
			'X-Content-Type-Options': 'nosniff'
		}
	});
}

/* ── The radiograph inbox ──────────────────────────────────────────────────────────────────── */

/**
 * The folder an X-ray sensor's or panoramic machine's own software exports into, set by
 * `RADIOGRAPH_INBOX`. Every one of them can write each new image to a folder — that is the
 * integration they all share, where their programming interfaces are each their own and mostly
 * closed. Null when the clinic has not set one up.
 *
 * Filed images are moved into `filed/` inside it rather than deleted: the export is the machine's
 * original, and a second copy of a radiograph costs disk, not a patient.
 */
export const INBOX_DIR = env.RADIOGRAPH_INBOX || null;

/** A panoramic exported at full resolution runs past the upload limit; this is a local copy. */
export const INBOX_MAX_BYTES = 50 * 1024 * 1024;

/** What an image file is, from its first bytes — the name is whatever the machine chose. */
export type ImageFormat = 'jpeg' | 'png' | 'dicom' | 'tiff' | 'other';

/** Reads a file's format from its signature. */
export function sniffFormat(head: Uint8Array): ImageFormat {
	const at = (offset: number, ...bytes: number[]) => bytes.every((b, i) => head[offset + i] === b);
	if (at(0, 0xff, 0xd8, 0xff)) return 'jpeg';
	if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'png';
	// "DICM" after a 128-byte preamble.
	if (at(128, 0x44, 0x49, 0x43, 0x4d)) return 'dicom';
	if (at(0, 0x49, 0x49, 0x2a, 0x00) || at(0, 0x4d, 0x4d, 0x00, 0x2a)) return 'tiff';
	return 'other';
}

/** One file waiting in the inbox. Only JPEG and PNG can be filed; the rest say why not. */
export type InboxFile = {
	name: string;
	size: number;
	modified: Date;
	format: ImageFormat;
};

/** The path of a file in the inbox, or null — the same containment check as the store's. */
export function resolveInboxFile(name: string): string | null {
	if (!INBOX_DIR) return null;
	const root = path.resolve(INBOX_DIR);
	const target = path.resolve(root, name);
	// Direct children only: `filed/` and anything deeper are not waiting.
	if (path.dirname(target) !== root) return null;
	if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
	return target;
}

async function formatOf(filePath: string): Promise<ImageFormat> {
	const handle = await open(filePath, 'r');
	try {
		const head = new Uint8Array(132);
		await handle.read(head, 0, 132, 0);
		return sniffFormat(head);
	} finally {
		await handle.close();
	}
}

/** The files waiting in the inbox, oldest first, or null when no inbox is set up. */
export async function inboxFiles(): Promise<InboxFile[] | null> {
	if (!INBOX_DIR) return null;
	const names = await readdir(INBOX_DIR).catch(() => [] as string[]);
	const files: InboxFile[] = [];
	for (const name of names) {
		if (name.startsWith('.')) continue;
		const target = resolveInboxFile(name);
		if (!target) continue;
		const info = await stat(target);
		files.push({ name, size: info.size, modified: info.mtime, format: await formatOf(target) });
	}
	return files.sort((a, b) => a.modified.getTime() - b.modified.getTime());
}

/**
 * Copies an inbox image into the store under a new random name, as an upload would be. Returns
 * what `attachFile` needs. The inbox file is left where it is: `markFiled` moves it once the row
 * that points at the copy is written.
 */
export async function adoptInboxFile(name: string) {
	const source = resolveInboxFile(name);
	if (!source) throw new Error('That image is no longer in the inbox.');
	const info = await stat(source);
	if (info.size > INBOX_MAX_BYTES) throw new Error('That image is larger than 50MB.');
	const format = await formatOf(source);
	if (format !== 'jpeg' && format !== 'png') {
		throw new Error(
			format === 'dicom' || format === 'tiff'
				? `A ${format.toUpperCase()} file cannot be shown in a browser. Set the sensor software to export JPEG or PNG.`
				: 'That file is not an image.'
		);
	}
	const ext = format === 'jpeg' ? 'jpg' : 'png';
	const storedName = `${generateFileName()}.${ext}`;
	await copyFile(source, path.join(FILES_DIR, storedName));
	return {
		storedName,
		originalName: name,
		mimeType: MIME_BY_EXTENSION[ext],
		sizeBytes: info.size,
		modified: info.mtime
	};
}

/** Moves a filed image out of the waiting list, into `filed/` beside it. */
export async function markFiled(name: string): Promise<void> {
	const source = resolveInboxFile(name);
	if (!source || !INBOX_DIR) return;
	const filed = path.join(INBOX_DIR, 'filed');
	await fs.promises.mkdir(filed, { recursive: true });
	await rename(source, path.join(filed, name));
}
