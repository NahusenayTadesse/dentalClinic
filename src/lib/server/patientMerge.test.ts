import { describe, expect, it } from 'vitest';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from './db';
import { allergen, clinicalNote, patient, patientAllergies } from './db/schema';
import { inRollback, type TestTx } from '$lib/testing/rollback';
import { insertReturningId } from './db/insert';
import { WriteRefused } from './childCrud';
import { NOT_MOVED, OWNED, mergePatients } from './patientMerge';

/**
 * Merging has to move everything a duplicate owns, and the thing most likely to break it is a
 * table added later that nobody adds to the list — so the first test asks the database which
 * tables point at `patient`. The rest build two patients inside a rollback and merge them.
 */
describe('patient merge', async () => {
	const [someAllergen] = await db.select({ id: allergen.id }).from(allergen).limit(1);
	const ready = Boolean(someAllergen);
	const request = {
		locals: { user: null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};

	it('moves every table the database says belongs to a patient', async () => {
		const [rows] = await db.execute(sql`
			SELECT DISTINCT k.TABLE_NAME AS name
			FROM information_schema.KEY_COLUMN_USAGE k
			WHERE k.CONSTRAINT_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME = 'patient'`);
		const pointing = (rows as unknown as { name: string }[]).map((r) => r.name).sort();
		const covered = [...OWNED.map((o) => o.name), ...NOT_MOVED].sort();
		expect(pointing.filter((name) => !covered.includes(name))).toEqual([]);
	});

	/** Two live patients with a name that marks them as this test's. */
	async function twoPatients(tx: TestTx) {
		const make = (name: string, phone: string | null) =>
			insertReturningId(tx, patient, {
				name,
				fatherName: 'Mergetest',
				sex: 'female',
				phone
			});
		return { keep: await make('Keep', null), dup: await make('Duplicate', '0911000111') };
	}

	it.skipIf(!ready)(
		'moves the duplicate’s record, keeps a shared allergy once, and leaves a tombstone',
		async () => {
			const result = await inRollback(async (tx) => {
				const { keep, dup } = await twoPatients(tx);
				// The kept record says moderate; the duplicate says severe. Severe has to survive.
				await tx
					.insert(patientAllergies)
					.values({ patientId: keep, allergenId: someAllergen.id, severity: 'moderate' });
				await tx.insert(patientAllergies).values({
					patientId: dup,
					allergenId: someAllergen.id,
					severity: 'severe',
					reaction: 'Anaphylaxis'
				});
				await tx
					.insert(clinicalNote)
					.values({ patientId: dup, body: 'Seen for pain.', kind: 'note' });
				const moved = await mergePatients(tx, request, { survivorId: keep, duplicateId: dup });

				const allergies = await tx
					.select({
						id: patientAllergies.id,
						severity: patientAllergies.severity,
						reaction: patientAllergies.reaction
					})
					.from(patientAllergies)
					.where(and(eq(patientAllergies.patientId, keep), isNull(patientAllergies.deletedAt)));
				const notes = await tx
					.select({ id: clinicalNote.id })
					.from(clinicalNote)
					.where(eq(clinicalNote.patientId, keep));
				const [kept] = await tx.select().from(patient).where(eq(patient.id, keep));
				const [tomb] = await tx.select().from(patient).where(eq(patient.id, dup));
				const again = await mergePatients(tx, request, { survivorId: keep, duplicateId: dup }).then(
					() => null,
					(err) => (err instanceof WriteRefused ? err.message : Promise.reject(err))
				);
				return { moved, allergies, notes, kept, tomb, again };
			});
			expect(result.allergies).toHaveLength(1);
			expect(result.allergies[0].severity).toBe('severe');
			expect(result.allergies[0].reaction).toBe('Anaphylaxis');
			expect(result.notes).toHaveLength(1);
			expect(result.moved.clinical_note).toBe(1);
			expect(result.kept.phone).toBe('0911000111');
			expect(result.tomb.mergedIntoId).toBe(result.kept.id);
			expect(result.again).toMatch(/already have been merged/);
		}
	);
});
