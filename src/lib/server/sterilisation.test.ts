import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from './db';
import { instrumentPack, patient, steriliser, sterilisationCycle, user } from './db/schema';
import { inRollback } from '$lib/testing/rollback';
import { WriteRefused } from './childCrud';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { readSporeTest, recordCycle, usePacks, type CycleInput } from './sterilisation';

/**
 * The log's rules: cycles numbered on per machine, packs labelled only from a load that passed its
 * strip, a pack opened once and never from a failed cycle, and a spore test read once. Built inside
 * rollbacks, with a steriliser of their own; a patient and a user are borrowed.
 */
describe('sterilisation', async () => {
	const [someone] = await db.select({ id: patient.id }).from(patient).limit(1);
	const [nurse] = await db.select({ id: user.id }).from(user).limit(1);
	const ready = Boolean(someone && nurse);

	const event = {
		locals: { user: nurse ? { id: nurse.id } : null, branch: { active: null } },
		getClientAddress: () => '127.0.0.1'
	};

	const load = (steriliserId: number, change: Partial<CycleInput> = {}): CycleInput => ({
		steriliserId,
		kind: 'load',
		ranAt: new Date(),
		program: '134 °C · 4 min',
		temperatureC: 134,
		holdMinutes: 4,
		chemical: 'pass',
		biological: 'pending',
		note: null,
		packs: [{ contents: 'Exam kit', count: 3 }],
		shelfDays: 30,
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

	it.skipIf(!ready)('numbers cycles on, labels packs, and opens each pack once', async () => {
		const result = await inRollback(async (tx) => {
			const machine = await insertReturningId(tx, steriliser, { name: 'Test autoclave' });
			const first = await recordCycle(tx, event, load(machine));
			const second = await recordCycle(tx, event, load(machine, { packs: [] }));
			const cycles = await tx
				.select({ id: sterilisationCycle.id, n: sterilisationCycle.cycleNo })
				.from(sterilisationCycle)
				.where(eq(sterilisationCycle.steriliserId, machine));
			const codes = (
				await tx
					.select({ code: instrumentPack.code })
					.from(instrumentPack)
					.where(eq(instrumentPack.cycleId, first))
			).map((p) => p.code);

			const failedStrip = await refused(
				recordCycle(tx, event, load(machine, { chemical: 'fail' }))
			);
			const testWithPacks = await refused(
				recordCycle(tx, event, load(machine, { kind: 'bowieDick' }))
			);

			const used = await usePacks(tx, event, someone.id, [codes[0]], null);
			const twice = await refused(usePacks(tx, event, someone.id, [codes[0]], null));
			const unknown = await refused(usePacks(tx, event, someone.id, ['9-9999-99'], null));

			await readSporeTest(tx, event, first, 'fail');
			const fromFailed = await refused(usePacks(tx, event, someone.id, [codes[1]], null));
			const readAgain = await refused(readSporeTest(tx, event, first, 'pass'));
			const [after] = await tx
				.select({ status: sterilisationCycle.status })
				.from(sterilisationCycle)
				.where(eq(sterilisationCycle.id, first));

			return {
				numbers: cycles.map((c) => c.n).sort(),
				second,
				codes,
				failedStrip,
				testWithPacks,
				used,
				twice,
				unknown,
				fromFailed,
				readAgain,
				status: after.status
			};
		});

		expect(result.numbers).toEqual([1, 2]);
		expect(result.codes).toHaveLength(3);
		expect(result.codes[0]).toMatch(/-0001-01$/);
		expect(result.failedStrip).toMatch(/Resterilise/);
		expect(result.testWithPacks).toMatch(/makes no packs/);
		expect(result.used).toBe(1);
		expect(result.twice).toMatch(/used/);
		expect(result.unknown).toMatch(/No pack/);
		expect(result.fromFailed).toMatch(/withdrawn/);
		expect(result.readAgain).toMatch(/no spore test waiting/);
		expect(result.status).toBe('failed');
	});
});
