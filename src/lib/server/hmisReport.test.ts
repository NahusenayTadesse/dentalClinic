import { describe, expect, it } from 'vitest';
import { ne } from 'drizzle-orm';

import { db } from './db';
import {
	appointment,
	branch,
	condition,
	patient,
	patientConditions,
	procedures,
	services
} from './db/schema';
import { inRollback, type TestTx } from '$lib/testing/rollback';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { fromClinic } from '$lib/clinicTime';
import { hmisPeriod, tallyTotals } from '$lib/hmisReport';
import { monthlyReturn } from './hmisReport';

/**
 * One month built from nothing inside a rollback — Tir 2025, January 2033, long after anything
 * a clinic has typed — and every figure of its return checked: new and repeat visits, one case
 * per patient per diagnosis, a diagnosis counted only where the patient was seen, and what cannot
 * be counted listed rather than dropped. Only the branches are borrowed.
 */
describe('monthlyReturn', async () => {
	const [here] = await db.select({ id: branch.id }).from(branch).limit(1);
	const [elsewhere] = here
		? await db.select({ id: branch.id }).from(branch).where(ne(branch.id, here.id)).limit(1)
		: [];
	const period = hmisPeriod(5, 2025);

	async function build(tx: TestTx) {
		const coded = await insertReturningId(tx, condition, {
			name: 'HMIS test — coded',
			hmisCode: 'T01',
			isDentalRelated: true
		});
		const uncoded = await insertReturningId(tx, condition, {
			name: 'HMIS test — uncoded',
			isDentalRelated: true
		});
		const finding = await insertReturningId(tx, services, {
			name: 'HMIS test finding',
			area: 'surface',
			conditionId: coded
		});
		const unlinked = await insertReturningId(tx, services, {
			name: 'HMIS test unlinked finding',
			area: 'tooth'
		});

		// Aged 32 in January 2033; and one whose age nobody recorded.
		const hana = await insertReturningId(tx, patient, {
			name: 'Hana',
			fatherName: 'Hmistest',
			sex: 'female',
			birthDate: new Date('2000-06-01T00:00:00Z')
		});
		const abel = await insertReturningId(tx, patient, {
			name: 'Abel',
			fatherName: 'Hmistest',
			sex: 'male'
		});

		const visit = (
			patientId: number,
			day: string,
			status: 'completed' | 'cancelled',
			branchId = here.id
		) =>
			insertReturningId(tx, appointment, {
				patientId,
				branchId,
				startsAt: fromClinic(day, '09:00'),
				status
			});
		await visit(hana, '2033-01-10', 'completed'); // her first ever: new
		await visit(hana, '2033-01-20', 'completed'); // repeat
		await visit(hana, '2033-01-22', 'cancelled'); // not a visit
		await visit(abel, '2032-12-01', 'completed'); // before the month, so his next is a repeat
		await visit(abel, '2033-01-12', 'completed'); // repeat
		if (elsewhere) await visit(abel, '2033-01-14', 'completed', elsewhere.id); // another facility

		const chart = (patientId: number, serviceId: number, day: string) =>
			insertReturningId(tx, procedures, {
				patientId,
				serviceId,
				branchId: here.id,
				status: 'condition',
				createdAt: fromClinic(day, '10:00')
			});
		// Two carious teeth at one examination are one case.
		await chart(hana, finding, '2033-01-10');
		await chart(hana, finding, '2033-01-10');
		await chart(abel, unlinked, '2033-01-12');

		await tx.insert(patientConditions).values([
			// Diagnosed on a day he was seen here: his case of the coded condition.
			{
				patientId: abel,
				conditionId: coded,
				status: 'active',
				diagnosedOn: new Date('2033-01-12')
			},
			// Diagnosed, but no code: listed as not counted.
			{
				patientId: hana,
				conditionId: uncoded,
				status: 'active',
				diagnosedOn: new Date('2033-01-10')
			}
		]);

		return monthlyReturn(here.id, period, tx);
	}

	it.skipIf(!here)('counts the month as the health office reads it', async () => {
		const report = await inRollback(build);
		expect(report).not.toBeNull();
		if (!report) return;

		expect(report.visits.new.thirtyToSixtyFour).toEqual({ male: 0, female: 1 });
		expect(tallyTotals(report.visits.new).all).toBe(1);
		expect(report.visits.repeat.thirtyToSixtyFour).toEqual({ male: 0, female: 1 });
		expect(report.visits.repeat.unknown).toEqual({ male: 1, female: 0 });
		expect(tallyTotals(report.visits.repeat).all).toBe(2);

		expect(report.cases).toHaveLength(1);
		const [caries] = report.cases;
		expect(caries.hmisCode).toBe('T01');
		expect(caries.tally.thirtyToSixtyFour).toEqual({ male: 0, female: 1 });
		expect(caries.tally.unknown).toEqual({ male: 1, female: 0 });
		expect(tallyTotals(caries.tally).all).toBe(2);

		expect(report.uncounted.uncoded).toEqual([
			expect.objectContaining({ name: 'HMIS test — uncoded', cases: 1 })
		]);
		expect(report.uncounted.unlinkedFindings).toEqual([
			expect.objectContaining({ name: 'HMIS test unlinked finding', findings: 1 })
		]);
		expect(report.uncounted.unknownAge).toEqual({ visits: 1, cases: 1 });
	});

	it.skipIf(!here)(
		'does not count a diagnosis made on a day the patient was not seen here',
		async () => {
			const report = await inRollback(async (tx) => {
				const coded = await insertReturningId(tx, condition, {
					name: 'HMIS test — elsewhere',
					hmisCode: 'T02',
					isDentalRelated: true
				});
				const someone = await insertReturningId(tx, patient, {
					name: 'Sara',
					fatherName: 'Hmistest',
					sex: 'female'
				});
				await tx.insert(patientConditions).values({
					patientId: someone,
					conditionId: coded,
					status: 'active',
					diagnosedOn: new Date('2033-01-15')
				});
				return monthlyReturn(here.id, period, tx);
			});
			expect(report?.cases.find((c) => c.hmisCode === 'T02')).toBeUndefined();
		}
	);
});
