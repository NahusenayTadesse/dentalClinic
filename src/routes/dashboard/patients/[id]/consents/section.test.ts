import { describe, expect, it } from 'vitest';
import { ne } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { procedures, provider } from '$lib/server/db/schema';
import { WriteRefused } from '$lib/server/childCrud';
import { clinicToday } from '$lib/clinicTime';
import { consentTransform } from './section';

/**
 * The consent rules the form cannot keep: a verbal consent names its witness, a withdrawal dates
 * itself once, and a treatment chosen from another patient's chart is refused. Reads only — the
 * transform decides what would be written. A provider and a procedure are borrowed.
 */
describe('consentTransform', async () => {
	const [witness] = await db.select({ id: provider.id }).from(provider).limit(1);
	const [work] = await db
		.select({ id: procedures.id, patientId: procedures.patientId })
		.from(procedures)
		.limit(1);
	const [elsewhere] = work
		? await db
				.select({ id: procedures.patientId })
				.from(procedures)
				.where(ne(procedures.patientId, work.patientId))
				.limit(1)
		: [];
	const ready = Boolean(witness && work && elsewhere);

	const base = (change: Record<string, unknown> = {}) => ({
		patientId: work?.patientId,
		consentType: 'surgical',
		method: 'written',
		givenOn: '2026-09-20',
		witnessedBy: '',
		procedureId: '',
		documentFileId: '',
		withdrawnReason: '',
		...change
	});

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
		'refuses a verbal consent without its witness, and takes one with',
		async () => {
			expect(await refused(consentTransform(base({ method: 'verbal' })))).toMatch(/witnessed/);
			const written = await consentTransform(
				base({ method: 'verbal', witnessedBy: String(witness.id) })
			);
			expect(written.witnessedBy).toBe(witness.id);
		}
	);

	it.skipIf(!ready)(
		'dates a withdrawal the first time, keeps the date after, and clears it if it stands again',
		async () => {
			const first = await consentTransform(base({ withdrawnReason: 'Changed her mind' }));
			expect(first.withdrawnOn).toBe(clinicToday());
			const again = await consentTransform(base({ withdrawnReason: 'Changed her mind' }), {
				withdrawnOn: '2026-06-01'
			});
			expect(again.withdrawnOn).toBe('2026-06-01');
			const standing = await consentTransform(base(), { withdrawnOn: '2026-06-01' });
			expect(standing.withdrawnOn).toBeNull();
		}
	);

	it.skipIf(!ready)('refuses a treatment from another patient’s chart', async () => {
		expect(
			await refused(
				consentTransform(base({ patientId: elsewhere.id, procedureId: String(work.id) }))
			)
		).toMatch(/not on this patient/);
		const mine = await consentTransform(base({ procedureId: String(work.id) }));
		expect(mine.procedureId).toBe(work.id);
	});
});
