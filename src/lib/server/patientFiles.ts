import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import { patientFile, user } from '$lib/server/db/schema';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { isoDate } from '$lib/server/db/dialect';
import { notDeleted, softDeleteOwnedRecord } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { WriteRefused, refuseUnless } from '$lib/server/childCrud';
import { checkedVisit } from '$lib/server/appointments';
import { isFdiTooth } from '$lib/teeth';
import type { Projection } from '$lib/radiographs';
import { adoptInboxFile, markFiled } from '$lib/server/files';
import { clinicDate } from '$lib/clinicTime';

/**
 * What is attached to a patient: radiographs, photographs, and paper — in the first year, mostly
 * phone photographs of old paper charts, taken at the desk.
 *
 * **The file knows its owner now.** `patient_file` is the table `fileAudit.ts` and the file route
 * both said was owed: a row per upload naming the patient it belongs to. That is what lets
 * `/dashboard/files/[name]` ask for `patients.view` on a patient's file, and log the opening of one,
 * instead of trusting that a random name is hard enough to guess (`fileOwner` below).
 *
 * **Bytes first, row second.** `saveUploadedFile` writes to disk before the transaction that
 * records it, because a file write cannot be rolled back. A failed insert leaves an unreferenced
 * file, which `fileAudit.ts` reports as an orphan — the harmless direction. The other order would
 * leave rows pointing at nothing.
 *
 * Every write is audited (`patient_file` is on the list). Removing one is a soft delete, a super
 * admin's (CLAUDE.md §9); the bytes stay, so a mistaken removal is recoverable and the audit row
 * still has something to point at.
 *
 * **Radiographs also arrive by themselves.** A sensor's software exports each image to a folder;
 * `attachFromInbox` files one from there (`server/files.ts` owns the folder).
 *
 * Non-goals: image editing, measurement on radiographs, and DICOM — a clinic here exports its
 * sensor's images as JPEG or PNG, and that is what is stored.
 */

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Tx | typeof db;

/** The kinds, as the schema lists them — for the form and the filter. */
export const FILE_KINDS = [
	'radiograph',
	'photo',
	'consent',
	'referral',
	'labResult',
	'paperRecord',
	'other'
] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/** A file already in the store, and what the person said about it. */
export type AttachInput = {
	storedName: string;
	originalName: string | null;
	mimeType: string | null;
	sizeBytes: number | null;
	kind: FileKind;
	/** For a radiograph only: what kind of film. */
	projection: Projection | null;
	takenOn: string | null;
	toothId: number | null;
	description: string | null;
	appointmentId: number | null;
};

const uploader = alias(user, 'file_uploader');

/** The patient's files, newest first. */
export async function patientFiles(patientId: number, reader: Reader = db) {
	return (
		reader
			.select({
				id: patientFile.id,
				kind: patientFile.kind,
				projection: patientFile.projection,
				storedName: patientFile.storedName,
				originalName: patientFile.originalName,
				mimeType: patientFile.mimeType,
				sizeBytes: patientFile.sizeBytes,
				toothId: patientFile.toothId,
				takenOn: isoDate(patientFile.takenOn),
				description: patientFile.description,
				uploadedBy: uploader.name,
				createdAt: patientFile.createdAt
			})
			.from(patientFile)
			// Attribution: a deleted user still uploaded what they uploaded (CLAUDE.md §9).
			.leftJoin(uploader, eq(uploader.id, patientFile.createdBy))
			.where(and(eq(patientFile.patientId, patientId), notDeleted(patientFile)))
			.orderBy(desc(patientFile.createdAt), desc(patientFile.id))
	);
}

/** Records a stored file against the patient. Returns the row's id. */
export async function attachFile(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	input: AttachInput
): Promise<number> {
	refuseUnless(
		input.projection === null || input.kind === 'radiograph',
		'Only a radiograph has a projection.',
		'projection'
	);
	refuseUnless(
		input.toothId === null || isFdiTooth(input.toothId),
		'Give the tooth as its FDI number — 11 to 48, or 51 to 85 for a milk tooth.',
		'toothId'
	);
	const id = await insertReturningId(tx, patientFile, {
		patientId,
		kind: input.kind,
		projection: input.projection,
		storedName: input.storedName,
		originalName: input.originalName?.slice(0, 255) || null,
		mimeType: input.mimeType,
		sizeBytes: input.sizeBytes,
		toothId: input.toothId,
		takenOn: input.takenOn,
		description: input.description?.trim() || null,
		appointmentId: await checkedVisit(tx, patientId, input.appointmentId),
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'patient_file', recordId: id, action: 'create' });
	return id;
}

/** Takes a file off the chart. The caller has checked `requireSuperAdmin`; the bytes are kept. */
export async function removeFile(tx: Tx, event: AuditRequest, patientId: number, fileId: number) {
	const done = await softDeleteOwnedRecord(
		tx,
		patientFile,
		patientFile.patientId,
		fileId,
		patientId,
		event.locals.user?.id
	);
	refuseUnless(done, 'That file is not on this patient’s record.');
	await recordAudit(tx, event, { table: 'patient_file', recordId: fileId, action: 'delete' });
}

/**
 * Whose file a stored name is, for the file route: the patient and the row, or null for a file
 * that is not a patient's (an employee's document, a receipt). Removed files are included — they
 * are still that patient's, and still need the permission to open.
 */
export async function fileOwner(storedName: string) {
	const [row] = await db
		.select({ id: patientFile.id, patientId: patientFile.patientId })
		.from(patientFile)
		.where(eq(patientFile.storedName, storedName))
		.limit(1);
	return row ?? null;
}

/**
 * Files an image from the radiograph inbox to a patient: copied into the store, attached as a
 * radiograph, and moved out of the waiting list — in that order, so a failure anywhere before the
 * last step leaves the image still waiting. Made on the day the machine wrote it, unless the
 * person filing it says otherwise.
 */
export async function attachFromInbox(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	input: {
		name: string;
		projection: Projection | null;
		toothId: number | null;
		takenOn: string | null;
		description: string | null;
		appointmentId: number | null;
	}
): Promise<number> {
	let adopted: Awaited<ReturnType<typeof adoptInboxFile>>;
	try {
		adopted = await adoptInboxFile(input.name);
	} catch (err: unknown) {
		// `adoptInboxFile`'s refusals are written for the person filing.
		throw new WriteRefused(
			'name',
			err instanceof Error ? err.message : 'That image could not be read.'
		);
	}
	const id = await attachFile(tx, event, patientId, {
		storedName: adopted.storedName,
		originalName: adopted.originalName,
		mimeType: adopted.mimeType,
		sizeBytes: adopted.sizeBytes,
		kind: 'radiograph',
		projection: input.projection,
		takenOn: input.takenOn ?? clinicDate(adopted.modified),
		toothId: input.toothId,
		description: input.description,
		appointmentId: input.appointmentId
	});
	await markFiled(input.name);
	return id;
}
