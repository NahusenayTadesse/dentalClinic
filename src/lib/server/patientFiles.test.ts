import { describe, expect, it } from 'vitest';

import { db } from './db';
import { patient } from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { WriteRefused } from './childCrud';
import { attachFile, patientFiles, removeFile, type AttachInput } from './patientFiles';

/**
 * A patient's file records its owner, which is what the file route now checks — so the owner has to
 * be right and has to survive removal. Built inside rollbacks, with no bytes on disk: the rows are
 * what is under test. A patient is borrowed.
 */
describe('patient files', async () => {
	const people = await db.select({ id: patient.id }).from(patient).limit(2);
	const ready = people.length === 2;
	const request = {
		locals: { user: null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};
	const film = (change: Partial<AttachInput> = {}): AttachInput => ({
		storedName: `test-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
		originalName: 'PA 36.png',
		mimeType: 'image/png',
		sizeBytes: 2048,
		kind: 'radiograph',
		projection: 'periapical',
		takenOn: '2026-09-20',
		toothId: 36,
		description: 'Periapical, 36',
		appointmentId: null,
		...change
	});

	it.skipIf(!ready)(
		'lists a file under its patient only, and keeps its owner after removal',
		async () => {
			const result = await inRollback(async (tx) => {
				const input = film();
				const id = await attachFile(tx, request, people[0].id, input);
				const mine = await patientFiles(people[0].id, tx);
				const theirs = await patientFiles(people[1].id, tx);
				let wrongOwner: string | null = null;
				try {
					await removeFile(tx, request, people[1].id, id);
				} catch (err) {
					if (err instanceof WriteRefused) wrongOwner = err.message;
					else throw err;
				}
				await removeFile(tx, request, people[0].id, id);
				const after = await patientFiles(people[0].id, tx);
				return { id, mine, theirs, wrongOwner, after };
			});
			expect(result.mine.map((f) => f.id)).toContain(result.id);
			expect(result.theirs.map((f) => f.id)).not.toContain(result.id);
			expect(result.wrongOwner).toMatch(/not on this patient/);
			expect(result.after.map((f) => f.id)).not.toContain(result.id);
		}
	);

	/** The refusal an attach meets, or null. */
	const refusal = (change: Partial<AttachInput>) =>
		inRollback(async (tx) => {
			try {
				await attachFile(tx, request, people[0].id, film(change));
			} catch (err) {
				if (err instanceof WriteRefused) return err.message;
				throw err;
			}
			return null;
		});

	it.skipIf(!ready)('refuses a tooth that is not an FDI number', async () => {
		expect(await refusal({ toothId: 19 })).toMatch(/FDI number/);
	});

	it.skipIf(!ready)('gives a projection to a radiograph only', async () => {
		expect(await refusal({ kind: 'photo' })).toMatch(/Only a radiograph/);
		expect(await refusal({ kind: 'photo', projection: null })).toBeNull();
	});
});
