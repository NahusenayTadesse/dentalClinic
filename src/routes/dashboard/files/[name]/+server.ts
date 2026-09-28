import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error, redirect } from '@sveltejs/kit';

import { mimeFor, resolveStoredFile } from '$lib/server/files';
import { fileOwner } from '$lib/server/patientFiles';
import { hasPermission } from '$lib/server/permissions';
import { logPatientView } from '$lib/server/patients';
import type { RequestHandler } from './$types';

/**
 * Serves one stored file.
 *
 * **What guards this.** A patient's file — a radiograph, a photograph, a scanned consent — is
 * recorded in `patient_file` with the patient it belongs to, so opening one needs `patients.view`,
 * the permission that opens the chart it hangs on, and is logged in that patient's access log.
 * Repeat fetches are folded together there (`logPatientView`), so a gallery of thumbnails is not
 * a flood.
 *
 * **Every other file** — an employee's identity document, a receipt — still has only the check
 * that the caller is signed in, and the 122-bit random name from `generateFileName` standing in
 * for a permission. Adequate against guessing, not against a leaked URL; those files get the same
 * treatment when their own tables record what owns them.
 */
export const GET: RequestHandler = async (event) => {
	const { params, request, locals } = event;
	if (!locals.user) throw redirect(302, '/login');

	// Rejects a name that resolves outside the store rather than resolving it and hoping.
	const filePath = resolveStoredFile(params.name);
	if (!filePath) throw error(404, 'Not found');

	const owner = await fileOwner(params.name);
	if (owner) {
		if (!hasPermission(locals, 'patients.view')) throw error(403, 'Not permitted');
		await logPatientView(owner.patientId, 'file', event, { recordId: owner.id });
	}

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
