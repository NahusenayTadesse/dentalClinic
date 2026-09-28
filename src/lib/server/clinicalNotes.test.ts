import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from './db';
import { clinicalNote, patient, user } from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { WriteRefused } from './childCrud';
import {
	amendNote,
	discardDraft,
	editDraft,
	patientNotes,
	signNote,
	writeNote
} from './clinicalNotes';

/**
 * The record-keeping rules, since they are the point of the module: a signed note never changes,
 * a correction stands beside the original, and a draft is only its author's to touch. Built inside
 * rollbacks; a patient and two users are borrowed.
 */
describe('clinical notes', async () => {
	const [someone] = await db.select({ id: patient.id }).from(patient).limit(1);
	const users = await db.select({ id: user.id }).from(user).limit(2);
	const ready = Boolean(someone && users.length === 2);

	const as = (id: string | undefined) => ({
		locals: { user: id ? { id } : null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	});
	const author = as(users[0]?.id);
	const colleague = as(users[1]?.id);

	const draft = {
		kind: 'examination' as const,
		summary: 'Upper left pain',
		body: 'Tender 26.',
		providerId: null,
		appointmentId: null
	};

	const refused = async (write: Promise<unknown>) => {
		try {
			await write;
		} catch (err) {
			if (err instanceof WriteRefused) return err.message;
			throw err;
		}
		return null;
	};

	it.skipIf(!ready)(
		'keeps a draft its author’s own until it is signed, then keeps it',
		async () => {
			const result = await inRollback(async (tx) => {
				const id = await writeNote(tx, author, someone.id, { ...draft, sign: false });
				const byColleague = await refused(editDraft(tx, colleague, someone.id, id, draft));
				await editDraft(tx, author, someone.id, id, { ...draft, body: 'Tender 26, percussion +.' });
				await signNote(tx, author, someone.id, id);
				const afterSigning = await refused(editDraft(tx, author, someone.id, id, draft));
				const discardSigned = await refused(discardDraft(tx, author, someone.id, id));
				const [row] = await tx.select().from(clinicalNote).where(eq(clinicalNote.id, id));
				return { byColleague, afterSigning, discardSigned, row };
			});
			expect(result.byColleague).toMatch(/Only the person who wrote/);
			expect(result.afterSigning).toMatch(/amendment/);
			expect(result.discardSigned).toMatch(/amendment/);
			expect(result.row.body).toBe('Tender 26, percussion +.');
			expect(result.row.signedAt).not.toBeNull();
			expect(result.row.deletedAt).toBeNull();
		}
	);

	it.skipIf(!ready)('adds a correction beside a signed note rather than changing it', async () => {
		const notes = await inRollback(async (tx) => {
			const id = await writeNote(tx, author, someone.id, { ...draft, sign: true });
			const first = await amendNote(tx, colleague, someone.id, id, {
				summary: 'Tooth number',
				body: 'Should read 27, not 26.'
			});
			// A correction of the correction still reads under the first note.
			await amendNote(tx, author, someone.id, first, { summary: null, body: 'Confirmed 27.' });
			return patientNotes(someone.id, tx);
		});
		const original = notes.find((n) => n.summary === 'Upper left pain');
		expect(original?.body).toBe('Tender 26.');
		expect(original?.amendments.map((a) => a.body)).toEqual([
			'Should read 27, not 26.',
			'Confirmed 27.'
		]);
		expect(original?.amendments.every((a) => a.signedAt)).toBe(true);
	});

	it.skipIf(!ready)('will not amend a draft, nor write a note with nothing in it', async () => {
		const result = await inRollback(async (tx) => {
			const id = await writeNote(tx, author, someone.id, { ...draft, sign: false });
			return {
				amendDraft: await refused(
					amendNote(tx, author, someone.id, id, { summary: null, body: 'x' })
				),
				empty: await refused(
					writeNote(tx, author, someone.id, { ...draft, body: '   ', sign: true })
				)
			};
		});
		expect(result.amendDraft).toMatch(/draft is changed/);
		expect(result.empty).toMatch(/Write the note/);
	});
});
