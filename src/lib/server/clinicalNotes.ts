import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import { appointment, clinicalNote, provider, user } from '$lib/server/db/schema';
import { insertReturningId } from '$lib/server/db/insert';
import { notDeleted, softDeleteOwnedRecord } from '$lib/server/softDelete';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { refuseUnless } from '$lib/server/childCrud';
import {
	checkedProvider,
	checkedVisit,
	providerEmployee,
	providerName
} from '$lib/server/appointments';

/**
 * A patient's clinical notes: the timeline, and the four things that can happen to a note.
 *
 * **A signed note is never changed.** The schema says why (`notes.ts`): a note may be read years
 * later by someone deciding whether care was reasonable. So there is no edit of a signed note here
 * at all — a correction is `amendNote`, a new note pointing at the original, and both are shown.
 *
 * **A draft belongs to whoever wrote it.** Only its author may change, sign or discard it, because a
 * note is a first-person record: signing someone else's draft would put a name to words its owner
 * never committed to. Anyone who may write notes can read it, marked as a draft.
 *
 * Every write is audited (`clinical_note` is on the list, CLAUDE.md §11) and runs in the caller's
 * transaction, through `patientAction`, which has already checked `patients.clinical` and that the
 * patient is live.
 *
 * Non-goals: templates, and structured examination findings — charted findings are procedures on
 * the dental chart, and a note is the prose around them.
 */

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The four kinds, as the schema lists them — for the form's select. */
export const NOTE_KINDS = ['examination', 'treatment', 'telephone', 'note'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

/** What a new note, a draft's edit or an amendment carries. */
export type NoteInput = {
	kind: NoteKind;
	summary: string | null;
	body: string;
	providerId: number | null;
	appointmentId: number | null;
};

const author = alias(user, 'note_author');

/**
 * Every note on the patient's record, newest first, each with the amendments made to it beneath it
 * in the order they were written. An amendment of an amendment is listed under the first note, so
 * a chain of corrections reads as one story.
 */
export async function patientNotes(patientId: number, reader: Tx | typeof db = db) {
	const rows = await reader
		.select({
			id: clinicalNote.id,
			kind: clinicalNote.kind,
			summary: clinicalNote.summary,
			body: clinicalNote.body,
			signedAt: clinicalNote.signedAt,
			amendsId: clinicalNote.amendsId,
			providerId: clinicalNote.providerId,
			provider: providerName,
			appointmentId: clinicalNote.appointmentId,
			visitAt: appointment.startsAt,
			authorId: clinicalNote.createdBy,
			author: author.name,
			createdAt: clinicalNote.createdAt
		})
		.from(clinicalNote)
		.leftJoin(provider, eq(provider.id, clinicalNote.providerId))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.leftJoin(appointment, eq(appointment.id, clinicalNote.appointmentId))
		// Attribution: a deleted user still wrote what they wrote (CLAUDE.md §9).
		.leftJoin(author, eq(author.id, clinicalNote.createdBy))
		.where(and(eq(clinicalNote.patientId, patientId), notDeleted(clinicalNote)))
		.orderBy(desc(clinicalNote.createdAt), desc(clinicalNote.id));

	type Row = (typeof rows)[number];
	const byId = new Map(rows.map((r) => [r.id, r]));
	/** The first note of a chain of amendments. */
	const rootOf = (row: Row): Row => {
		let current = row;
		for (let depth = 0; current.amendsId && depth < 50; depth++) {
			const parent = byId.get(current.amendsId);
			if (!parent) break;
			current = parent;
		}
		return current;
	};

	const amendments = new Map<number, Row[]>();
	const roots: Row[] = [];
	for (const row of rows) {
		const root = rootOf(row);
		if (root === row) roots.push(row);
		else amendments.set(root.id, [...(amendments.get(root.id) ?? []), row]);
	}
	return roots.map((root) => ({
		...root,
		amendments: (amendments.get(root.id) ?? []).sort((a, b) => a.id - b.id)
	}));
}

/** One entry of `patientNotes`. */
export type NoteEntry = Awaited<ReturnType<typeof patientNotes>>[number];

/** The columns a note's input writes, checked. */
async function checkedValues(tx: Tx, patientId: number, input: NoteInput) {
	const body = input.body.trim();
	refuseUnless(body.length > 0, 'Write the note.', 'body');
	return {
		kind: input.kind,
		summary: input.summary?.trim() || null,
		body,
		providerId: await checkedProvider(tx, input.providerId),
		appointmentId: await checkedVisit(tx, patientId, input.appointmentId)
	};
}

/**
 * A note, re-read and locked, checked to be this patient's. A draft being changed must also be the
 * caller's own and not yet signed.
 */
async function noteFor(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	noteId: number,
	{ ownDraft }: { ownDraft: boolean }
) {
	const [row] = await tx
		.select()
		.from(clinicalNote)
		.where(
			and(
				eq(clinicalNote.id, noteId),
				eq(clinicalNote.patientId, patientId),
				notDeleted(clinicalNote)
			)
		)
		.limit(1)
		.for('update');
	refuseUnless(Boolean(row), 'That note is not on this patient’s record.');
	if (ownDraft) {
		refuseUnless(!row.signedAt, 'A signed note is not changed. Add an amendment instead.');
		refuseUnless(
			row.createdBy === event.locals.user?.id,
			'Only the person who wrote a draft can change, sign or discard it.'
		);
	}
	return row;
}

/** Writes a note, as a draft or signed at once. Returns its id. */
export async function writeNote(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	input: NoteInput & { sign: boolean }
): Promise<number> {
	const values = await checkedValues(tx, patientId, input);
	const id = await insertReturningId(tx, clinicalNote, {
		...values,
		patientId,
		signedAt: input.sign ? new Date() : null,
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, { table: 'clinical_note', recordId: id, action: 'create' });
	return id;
}

/** Changes a draft. Its author only, and only while it is unsigned. */
export async function editDraft(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	noteId: number,
	input: NoteInput
) {
	const before = await noteFor(tx, event, patientId, noteId, { ownDraft: true });
	const values = {
		...(await checkedValues(tx, patientId, input)),
		updatedBy: event.locals.user?.id
	};
	await tx.update(clinicalNote).set(values).where(eq(clinicalNote.id, noteId));
	await recordAudit(tx, event, {
		table: 'clinical_note',
		recordId: noteId,
		action: 'update',
		before,
		after: values
	});
}

/** Signs a draft, after which it is read-only for good. */
export async function signNote(tx: Tx, event: AuditRequest, patientId: number, noteId: number) {
	const before = await noteFor(tx, event, patientId, noteId, { ownDraft: true });
	const values = { signedAt: new Date(), updatedBy: event.locals.user?.id };
	await tx.update(clinicalNote).set(values).where(eq(clinicalNote.id, noteId));
	await recordAudit(tx, event, {
		table: 'clinical_note',
		recordId: noteId,
		action: 'update',
		before,
		after: values
	});
}

/** Throws a draft away. Its author only; a signed note is never deleted from the chart. */
export async function discardDraft(tx: Tx, event: AuditRequest, patientId: number, noteId: number) {
	await noteFor(tx, event, patientId, noteId, { ownDraft: true });
	await softDeleteOwnedRecord(
		tx,
		clinicalNote,
		clinicalNote.patientId,
		noteId,
		patientId,
		event.locals.user?.id
	);
	await recordAudit(tx, event, { table: 'clinical_note', recordId: noteId, action: 'delete' });
}

/**
 * Corrects a signed note by adding one: signed at once, pointing at the note it corrects, so the
 * original and the correction both stand. A draft is changed rather than amended.
 */
export async function amendNote(
	tx: Tx,
	event: AuditRequest,
	patientId: number,
	noteId: number,
	input: Pick<NoteInput, 'body' | 'summary'>
): Promise<number> {
	const original = await noteFor(tx, event, patientId, noteId, { ownDraft: false });
	refuseUnless(Boolean(original.signedAt), 'A draft is changed, not amended.');
	const body = input.body.trim();
	refuseUnless(body.length > 0, 'Write the correction.', 'body');
	// The original's clinician and visit, unchecked: they were checked when it was written, and a
	// dentist who has since left must not make their notes uncorrectable.
	const id = await insertReturningId(tx, clinicalNote, {
		kind: original.kind,
		summary: input.summary?.trim() || null,
		body,
		providerId: original.providerId,
		appointmentId: original.appointmentId,
		patientId,
		amendsId: original.id,
		signedAt: new Date(),
		createdBy: event.locals.user?.id
	});
	await recordAudit(tx, event, {
		table: 'clinical_note',
		recordId: id,
		action: 'create',
		detail: { amends: original.id }
	});
	return id;
}
