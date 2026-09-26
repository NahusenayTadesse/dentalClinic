import { describe, expect, it } from 'vitest';
import { WriteRefused } from './childCrud';
import { completionDate, placeProcedure } from './procedures';
import { clinicToday } from '$lib/clinicTime';

/** The field a refusal names, or the result when there was none. */
function refusedField(fn: () => unknown): string | null | 'no refusal' {
	try {
		fn();
		return 'no refusal';
	} catch (err: unknown) {
		if (err instanceof WriteRefused) return err.field;
		throw err;
	}
}

describe('placing a procedure', () => {
	it('clears what a whole-mouth service does not use rather than refusing', () => {
		expect(placeProcedure('mouth', { toothId: 36, surfaces: 'MO', toothRange: '14-16' })).toEqual({
			toothId: null,
			surfaces: null,
			toothRange: null
		});
	});

	it('keeps an extraction free of surfaces', () => {
		expect(placeProcedure('tooth', { toothId: 48, surfaces: 'O' })).toEqual({
			toothId: 48,
			surfaces: null,
			toothRange: null
		});
	});

	it('puts a filling on its tooth with its surfaces in written order', () => {
		expect(placeProcedure('surface', { toothId: 36, surfaces: 'dom' })).toEqual({
			toothId: 36,
			surfaces: 'MOD',
			toothRange: null
		});
	});

	it('stores a bridge as a span, with its first tooth as the tooth', () => {
		expect(placeProcedure('range', { toothRange: '14-16' })).toEqual({
			toothId: 16,
			surfaces: null,
			toothRange: '16,15,14'
		});
	});

	it('names the field that is missing or wrong', () => {
		expect(refusedField(() => placeProcedure('tooth', {}))).toBe('toothId');
		expect(refusedField(() => placeProcedure('tooth', { toothId: 19 }))).toBe('toothId');
		expect(refusedField(() => placeProcedure('surface', { toothId: 36 }))).toBe('surfaces');
		expect(refusedField(() => placeProcedure('surface', { toothId: 11, surfaces: 'O' }))).toBe(
			'surfaces'
		);
		expect(refusedField(() => placeProcedure('range', { toothRange: '' }))).toBe('toothRange');
		expect(refusedField(() => placeProcedure('range', { toothRange: '16-24' }))).toBe('toothRange');
	});
});

describe('completion date', () => {
	it('dates work the day it is first marked done, by the clinic calendar', () => {
		expect(completionDate('completed')).toBe(clinicToday());
		expect(completionDate('completed', { status: 'planned', completedOn: null })).toBe(
			clinicToday()
		);
	});

	/*
	 * Re-saving a note on last month's filling must not move it to today, and must not rewrite the
	 * stored date at all: reading it back through the driver and writing it again can shift it a day.
	 */
	it('leaves an already-done date alone', () => {
		expect(
			completionDate('completed', { status: 'completed', completedOn: new Date(2026, 7, 1) })
		).toBeUndefined();
	});

	it('clears the date when work is no longer done', () => {
		expect(
			completionDate('planned', { status: 'completed', completedOn: '2026-08-01' })
		).toBeNull();
		expect(completionDate('condition')).toBeNull();
	});
});

/*
 * The half of the transform that needs the database: the service decides the placement and the
 * fee, and a visit has to be this patient's. Read-only — the transform writes nothing — so these
 * borrow existing rows rather than build them, and skip on a database that has none.
 */
describe('the charting transform, against the database', async () => {
	const { db } = await import('$lib/server/db');
	const { appointment, services } = await import('$lib/server/db/schema');
	const { and, eq, ne, isNotNull } = await import('drizzle-orm');
	const { procedureTransform } = await import('./procedures');

	const [filling] = await db
		.select({ id: services.id, price: services.price })
		.from(services)
		.where(and(eq(services.area, 'surface'), isNotNull(services.price)))
		.limit(1);
	const [visit] = await db
		.select({ id: appointment.id, patientId: appointment.patientId })
		.from(appointment)
		.limit(1);
	const [elsewhere] = visit
		? await db
				.select({ id: appointment.id })
				.from(appointment)
				.where(ne(appointment.patientId, visit.patientId))
				.limit(1)
		: [];

	const ready = Boolean(filling && visit && elsewhere);
	const event = { locals: { branch: { active: 1 } } };
	const base = () => ({
		patientId: visit.patientId,
		serviceId: filling.id,
		status: 'planned',
		toothId: 36,
		surfaces: 'od'
	});

	it.skipIf(!ready)(
		'takes the service price when no fee is typed, in written surface order',
		async () => {
			const row = await procedureTransform(base(), event);
			expect(row).toMatchObject({ fee: filling.price, surfaces: 'OD', toothId: 36, branchId: 1 });
		}
	);

	it.skipIf(!ready)('never charges for a finding, whatever fee is posted', async () => {
		const row = await procedureTransform({ ...base(), status: 'condition', fee: 5000 }, event);
		expect(row.fee).toBeNull();
	});

	it.skipIf(!ready)('refuses done work with nobody named as having done it', async () => {
		await expect(procedureTransform({ ...base(), status: 'completed' }, event)).rejects.toThrow(
			WriteRefused
		);
	});

	it.skipIf(!ready)('refuses another patient’s visit', async () => {
		await expect(
			procedureTransform({ ...base(), appointmentId: elsewhere.id }, event)
		).rejects.toMatchObject({ field: 'appointmentId' });
		const own = await procedureTransform({ ...base(), appointmentId: visit.id }, event);
		expect(own.appointmentId).toBe(visit.id);
	});
});

/*
 * Completing a visit writes clinical records on the strength of ids the browser posted, so the
 * rules that matter are the refusals: work must be this patient's and still planned, and only a
 * whole-mouth service can be added without a tooth. Built inside a rollback; only the visit, the
 * provider and the services are borrowed.
 */
describe('recording the work done at a visit', async () => {
	const { db } = await import('$lib/server/db');
	const { appointment, procedures, provider, services } = await import('$lib/server/db/schema');
	const { and, eq, ne } = await import('drizzle-orm');
	const { recordVisitWork } = await import('./procedures');
	const { inRollback } = await import('../testing/rollback');

	const [visit] = await db
		.select({ id: appointment.id, patientId: appointment.patientId })
		.from(appointment)
		.limit(1);
	const [dentist] = await db.select({ id: provider.id }).from(provider).limit(1);
	const byArea = async (area: 'mouth' | 'tooth' | 'surface') =>
		(
			await db
				.select({ id: services.id, price: services.price })
				.from(services)
				.where(and(eq(services.area, area), eq(services.status, true)))
				.limit(1)
		)[0];
	const [mouth, toothService, surface] = await Promise.all([
		byArea('mouth'),
		byArea('tooth'),
		byArea('surface')
	]);
	const [other] = visit
		? await db
				.select({ patientId: appointment.patientId })
				.from(appointment)
				.where(ne(appointment.patientId, visit.patientId))
				.limit(1)
		: [];

	const ready = Boolean(visit && dentist && mouth && toothService && surface && other);
	const request = {
		locals: { user: null, branch: { active: 1 } },
		getClientAddress: () => '127.0.0.1'
	};
	// A visit that happened on 10 March, closed whenever the test runs.
	const onTheDay = () => ({
		id: visit.id,
		patientId: visit.patientId,
		providerId: dentist.id,
		branchId: 1,
		startsAt: new Date('2026-03-10T09:00:00Z')
	});

	it.skipIf(!ready)(
		'dates the work to the visit, credits the visit’s dentist, and adds the usual service',
		async () => {
			const saved = await inRollback(async (tx) => {
				const [{ id: plannedId }] = await tx
					.insert(procedures)
					.values({
						patientId: visit.patientId,
						serviceId: surface.id,
						status: 'planned',
						toothId: 36,
						surfaces: 'O'
					})
					.$returningId();

				const recorded = await recordVisitWork(tx, request, onTheDay(), {
					procedureIds: [plannedId],
					serviceIds: [mouth.id]
				});
				const rows = await tx
					.select({
						serviceId: procedures.serviceId,
						status: procedures.status,
						completedOn: procedures.completedOn,
						appointmentId: procedures.appointmentId,
						providerId: procedures.providerId,
						fee: procedures.fee
					})
					.from(procedures)
					.where(eq(procedures.appointmentId, visit.id));
				return { recorded, rows };
			});

			expect(saved.recorded).toBe(2);
			const done = { status: 'completed', completedOn: '2026-03-10', providerId: dentist.id };
			expect(saved.rows).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ ...done, serviceId: surface.id }),
					expect.objectContaining({ ...done, serviceId: mouth.id, fee: mouth.price })
				])
			);
		}
	);

	it.skipIf(!ready)('refuses another patient’s planned work', async () => {
		await expect(
			inRollback(async (tx) => {
				const [{ id: theirs }] = await tx
					.insert(procedures)
					.values({
						patientId: other.patientId,
						serviceId: surface.id,
						status: 'planned',
						toothId: 36,
						surfaces: 'O'
					})
					.$returningId();
				return recordVisitWork(tx, request, onTheDay(), { procedureIds: [theirs], serviceIds: [] });
			})
		).rejects.toThrow(WriteRefused);
	});

	it.skipIf(!ready)('refuses to add a service that needs a tooth', async () => {
		await expect(
			inRollback((tx) =>
				recordVisitWork(tx, request, onTheDay(), {
					procedureIds: [],
					serviceIds: [toothService.id]
				})
			)
		).rejects.toThrow(WriteRefused);
	});
});
