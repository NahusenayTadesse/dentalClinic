import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
	FILES_DIR,
	MAX_UPLOAD_BYTES,
	mimeFor,
	resolveStoredFile,
	saveUploadedFile,
	sniffFormat
} from './files';

/**
 * The store holds identity documents and clinical attachments, so these are security tests
 * wearing the clothes of unit tests.
 */
describe('resolveStoredFile', () => {
	it('refuses a name that climbs out of the store', () => {
		// `path.normalize` resolves `..` rather than rejecting it, so before the containment
		// check this yielded the directory above the store.
		expect(resolveStoredFile('..')).toBeNull();
		expect(resolveStoredFile('../..')).toBeNull();
		expect(resolveStoredFile('a/../../etc/passwd')).toBeNull();
	});

	it('refuses an absolute path', () => {
		expect(resolveStoredFile('/etc/passwd')).toBeNull();
	});

	it('refuses a sibling directory with the same prefix', () => {
		// A plain `startsWith(root)` would accept `filesX`; the separator is what stops it.
		expect(resolveStoredFile(`../${path.basename(path.resolve(FILES_DIR))}X/secret`)).toBeNull();
	});

	it('returns null for a name inside the store that does not exist', () => {
		expect(resolveStoredFile('definitely-not-here.png')).toBeNull();
	});
});

describe('mimeFor', () => {
	it('serves iPhone photographs as images, not downloads', () => {
		// Accepted on upload all along; the serving table had never been told about them.
		expect(mimeFor('x.heic')).toBe('image/heic');
		expect(mimeFor('x.heif')).toBe('image/heif');
	});

	it('covers the everyday formats', () => {
		expect(mimeFor('scan.pdf')).toBe('application/pdf');
		expect(mimeFor('photo.JPG')).toBe('image/jpeg');
		expect(mimeFor('shot.png')).toBe('image/png');
	});

	it('falls back to a download for anything unknown', () => {
		expect(mimeFor('payload.exe')).toBe('application/octet-stream');
		expect(mimeFor('noextension')).toBe('application/octet-stream');
	});
});

describe('saveUploadedFile', () => {
	const upload = (name: string, type: string, bytes = 8) =>
		new File([new Uint8Array(bytes)], name, { type });

	/*
	 * These tests write to the real store, because the point of the last two is what lands on
	 * disk. Nothing else cleans up after them — there is no delete path anywhere in the app —
	 * so they track what they wrote and remove it themselves.
	 */
	const written: string[] = [];
	const save = async (file: File) => {
		const name = await saveUploadedFile(file);
		written.push(name);
		return name;
	};

	afterAll(() => {
		for (const name of written) {
			const target = resolveStoredFile(name);
			if (target) fs.rmSync(target);
		}
	});

	it('rejects a missing file instead of throwing from the stream plumbing', async () => {
		await expect(saveUploadedFile(undefined)).rejects.toThrow('No file was uploaded.');
	});

	it('rejects an empty file', async () => {
		await expect(saveUploadedFile(upload('e.png', 'image/png', 0))).rejects.toThrow(
			'No file was uploaded.'
		);
	});

	it('enforces the size limit server-side, not only in the browser', async () => {
		const tooBig = upload('big.png', 'image/png', MAX_UPLOAD_BYTES + 1);
		await expect(saveUploadedFile(tooBig)).rejects.toThrow(/larger than/);
	});

	it('rejects a type the store will not serve back', async () => {
		// Anything not in the MIME table would be served as octet-stream, so it is refused here.
		await expect(saveUploadedFile(upload('shell.exe', 'application/x-msdownload'))).rejects.toThrow(
			'That file type is not accepted.'
		);
	});

	it('names the file from the declared type, not the client-supplied filename', async () => {
		// A PNG called `invoice.pdf` must not end up served as a PDF.
		const stored = await save(upload('invoice.pdf', 'image/png'));
		expect(stored.endsWith('.png')).toBe(true);
		expect(mimeFor(stored)).toBe('image/png');
	});

	it('gives every upload a name that will never be reused', async () => {
		const a = await save(upload('a.png', 'image/png'));
		const b = await save(upload('a.png', 'image/png'));
		expect(a).not.toBe(b);
		// 122 bits as a UUID. Two things rest on this: it stands in for a permission check, and
		// it is why the serving route may mark a file `immutable` — a replacement never lands
		// on an existing URL.
		expect(a.split('.')[0]).toHaveLength(36);
	});
});

describe('sniffFormat', () => {
	const bytes = (at: number, ...values: number[]) => {
		const head = new Uint8Array(132);
		head.set(values, at);
		return head;
	};

	it('reads the format from the signature, not the name', () => {
		expect(sniffFormat(bytes(0, 0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
		expect(sniffFormat(bytes(0, 0x89, 0x50, 0x4e, 0x47))).toBe('png');
		expect(sniffFormat(bytes(128, 0x44, 0x49, 0x43, 0x4d))).toBe('dicom');
		expect(sniffFormat(bytes(0, 0x49, 0x49, 0x2a, 0x00))).toBe('tiff');
		expect(sniffFormat(bytes(0, 0x25, 0x50, 0x44, 0x46))).toBe('other');
	});
});
