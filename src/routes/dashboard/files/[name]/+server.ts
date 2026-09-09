import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error, redirect } from '@sveltejs/kit';

import { mimeFor, resolveStoredFile } from '$lib/server/files';
import type { RequestHandler } from './$types';

/**
 * Serves one stored file.
 *
 * **What guards this, and what does not.** The only check is that the caller is signed in — the
 * store is flat and a filename carries no record of what it is attached to, so there is nothing
 * here to check a permission *against*. What stands in for that is the name: 122 bits of
 * randomness from `generateFileName`, which is why that function's comment says what it says.
 *
 * That is adequate against guessing and inadequate against a leaked URL, and it cannot become a
 * real control until a file knows which record owns it. Recording that is the next piece of work
 * on this subsystem; until then, do not treat these URLs as secrets that can be shared.
 */
export const GET: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	// Rejects a name that resolves outside the store rather than resolving it and hoping.
	const filePath = resolveStoredFile(params.name);
	if (!filePath) throw error(404, 'Not found');

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
			'Cache-Control': 'private, max-age=31536000, immutable',
			'Last-Modified': stats.mtime.toUTCString(),
			// Nothing here is meant to be interpreted as markup by the browser.
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
