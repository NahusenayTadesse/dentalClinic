/**
 * The dental chart's server side: what a patient has had done, and the rules a charted procedure
 * must meet before it is saved.
 *
 * **The rules live on the server because only the server knows the service.** Whether a procedure
 * needs a tooth, surfaces or a span depends on `services.area`, and a form that posts
 * `serviceId: 7` could post anything else beside it. The form helps; `procedureTransform` decides.
 * The pure half of it — where on the mouth the work goes — is `placeProcedure`, tested without a
 * database.
 *
 * What the transform settles, that the client is never trusted with:
 *
 *   - the **placement**: a tooth, its surfaces in written order, or a span; nothing the service
 *     does not call for, so an extraction cannot carry surfaces into a report
 *   - the **fee**: the form's figure, else the service's list price, and none at all for a finding
 *     or for work another clinic did (`UNBILLED_STATUSES`)
 *   - the **completion date**: set when work is first marked done, kept on later edits, cleared if
 *     it is un-done — the same rule as a resolved condition on the medical history
 *   - the **visit**: an appointment of *this* patient's, or none. A posted appointment id from
 *     another patient would file this work on their day sheet
 *   - the **branch**: the one being worked at, on a new row (CLAUDE.md §15)
 *
 * Non-goals: billing (an invoice snapshots procedures; it does not live here), treatment plans
 * (they quote procedures), and periodontal charting (see `$lib/teeth.ts`).
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import {
	appointment,
	appointmentTypeServices,
	procedures,
	provider,
	serviceCategories,
	services
} from '$lib/server/db/schema';
import { notDeleted } from '$lib/server/softDelete';
import { WriteRefused } from '$lib/server/childCrud';
import { providerEmployee, providerName } from '$lib/server/appointments';
import { clinicDate, clinicToday } from '$lib/clinicTime';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { insertReturningId } from '$lib/server/db/insert';
import { UNBILLED_STATUSES, isProcedureStatus } from '$lib/procedureStatus';
import type { ServiceArea } from '$lib/serviceAreas';
import { isFdiTooth, normaliseSurfaces, parseToothRange } from '$lib/teeth';

/** The placement columns, as `placeProcedure` returns them. */
export type Placement = {
	toothId: number | null;
	surfaces: string | null;
	toothRange: string | null;
};

/**
 * Where a procedure goes, given what its service is charted on — or `WriteRefused` naming the field
 * that is missing or wrong.
 *
 * Fields the area does not use are cleared rather than refused. Switching a charted filling to a
 * whole-mouth service leaves the tooth and surfaces in the form, and refusing would make the user
 * clear boxes that no longer mean anything.
 */
export function placeProcedure(
	area: ServiceArea,
	input: { toothId?: number | null; surfaces?: string | null; toothRange?: string | null }
): Placement {
	const tooth = input.toothId ?? null;

	if (area === 'mouth') return { toothId: null, surfaces: null, toothRange: null };

	if (area === 'range') {
		if (!input.toothRange?.trim()) {
			throw new WriteRefused('toothRange', 'List the teeth this work spans, e.g. 14-16.');
		}
		const parsed = parseToothRange(input.toothRange);
		if ('error' in parsed) throw new WriteRefused('toothRange', parsed.error);
		// The first tooth doubles as `toothId`, so "every procedure on 14" still finds the bridge.
		return { toothId: parsed.teeth[0], surfaces: null, toothRange: parsed.teeth.join(',') };
	}

	if (tooth === null) throw new WriteRefused('toothId', 'Choose the tooth.');
	if (!isFdiTooth(tooth)) throw new WriteRefused('toothId', `${tooth} is not a tooth.`);

	if (area === 'tooth') return { toothId: tooth, surfaces: null, toothRange: null };

	const checked = normaliseSurfaces(input.surfaces ?? '', tooth);
	if ('error' in checked) throw new WriteRefused('surfaces', checked.error);
	return { toothId: tooth, surfaces: checked.surfaces, toothRange: null };
}

/**
 * The completion date a status implies: `undefined` (leave the stored date alone) when the work was
 * already done, today when it has just been, and `null` when it no longer is.
 *
 * Kept by not writing it rather than by writing it again: re-saving a note must not touch the day
 * the work was done, whatever the edit carried.
 *
 * Today at the clinic, not on the server: a server running on UTC would date anything charted
 * before 3 a.m. Addis Ababa time as the day before.
 */
export function completionDate(
	status: string,
	before?: { status?: unknown; completedOn?: unknown }
): string | null | undefined {
	if (status !== 'completed') return null;
	if (before?.status === 'completed' && before.completedOn) return undefined;
	return clinicToday();
}

/** `completionDate` as a spread: no key at all when the stored date is to be kept. */
function completedOnFor(status: string, before?: Record<string, unknown>) {
	const date = completionDate(status, before);
	return date === undefined ? {} : { completedOn: date };
}

/** A form value that may be empty, as a positive integer id or null. */
function idOrNull(value: unknown): number | null {
	const n = Number(value);
	return value === null || value === undefined || value === '' || !Number.isInteger(n) || n <= 0
		? null
		: n;
}

/**
 * The `childCrud` transform for a patient's procedures: every rule in this module's header, applied
 * to the row on its way to the database.
 *
 * On an add, the owner is already stamped on `values`; on an edit it is read from `before`, since
 * an edit can never move a row to another patient.
 */
export async function procedureTransform(
	values: Record<string, unknown>,
	/** Only the working branch is read — typed as that, so a test need not fake a whole request. */
	event: { locals: { branch: Pick<RequestEvent['locals']['branch'], 'active'> } },
	before?: Record<string, unknown>
): Promise<Record<string, unknown>> {
	const patientId = Number(values.patientId ?? before?.patientId);
	const status = String(values.status ?? '');
	if (!isProcedureStatus(status)) throw new WriteRefused('status', 'Choose a status.');

	const serviceId = idOrNull(values.serviceId);
	const [service] = serviceId
		? await db
				.select({ area: services.area, price: services.price })
				.from(services)
				.where(and(eq(services.id, serviceId), notDeleted(services)))
				.limit(1)
		: [];
	if (!service) throw new WriteRefused('serviceId', 'Choose what was done or found.');

	const placement = placeProcedure(service.area, {
		toothId: idOrNull(values.toothId),
		surfaces: typeof values.surfaces === 'string' ? values.surfaces : null,
		toothRange: typeof values.toothRange === 'string' ? values.toothRange : null
	});

	const providerId = idOrNull(values.providerId);
	if (status === 'completed' && providerId === null) {
		// Production per dentist is counted from this column; work nobody did cannot be counted.
		throw new WriteRefused('providerId', 'Say who did the work.');
	}

	const appointmentId = idOrNull(values.appointmentId);
	if (appointmentId !== null) {
		const [visit] = await db
			.select({ id: appointment.id })
			.from(appointment)
			.where(
				and(
					eq(appointment.id, appointmentId),
					eq(appointment.patientId, patientId),
					notDeleted(appointment)
				)
			)
			.limit(1);
		if (!visit) throw new WriteRefused('appointmentId', 'That visit is not one of this patient’s.');
	}

	const typedFee = values.fee === '' || values.fee === null || values.fee === undefined;
	const fee = UNBILLED_STATUSES.includes(status)
		? null
		: typedFee
			? service.price
			: Number(values.fee);

	return {
		...values,
		serviceId,
		status,
		...placement,
		providerId,
		appointmentId,
		fee,
		...completedOnFor(status, before),
		note: typeof values.note === 'string' && values.note.trim() ? values.note.trim() : null,
		// A new row is filed at the branch being worked at; an edit leaves it where it was done.
		...(before ? {} : { branchId: event.locals.branch.active ?? undefined })
	};
}

/**
 * Services a clinician can chart, with what each needs and costs. Active only: a retired service
 * stays readable on the procedures that used it, but is not offered for new ones.
 */
export async function chartableServices() {
	return db
		.select({
			value: services.id,
			name: services.name,
			area: services.area,
			price: services.price,
			removesTooth: services.removesTooth,
			category: serviceCategories.name
		})
		.from(services)
		.leftJoin(
			serviceCategories,
			and(eq(serviceCategories.id, services.categoryId), notDeleted(serviceCategories))
		)
		.where(and(eq(services.status, true), notDeleted(services)))
		.orderBy(asc(serviceCategories.name), asc(services.name));
}

/**
 * This patient's visits, newest first, to say which one a procedure was done at. Every branch's:
 * the chart is the patient's (CLAUDE.md §15).
 */
export async function visitOptions(patientId: number) {
	const rows = await db
		.select({ value: appointment.id, startsAt: appointment.startsAt, status: appointment.status })
		.from(appointment)
		.where(and(eq(appointment.patientId, patientId), notDeleted(appointment)))
		.orderBy(desc(appointment.startsAt))
		.limit(30);
	return rows.map((r) => ({ value: r.value, startsAt: r.startsAt, status: r.status }));
}

/**
 * Every procedure on the patient's chart, with what the chart and the table show about each.
 *
 * Newest activity first: done work by the day it was done, everything else by when it was charted.
 * A retired service or provider still names the row — the joins drop the name only when the row it
 * came from is deleted, never the procedure.
 */
export async function chartProcedures(patientId: number) {
	return db
		.select({
			id: procedures.id,
			serviceId: procedures.serviceId,
			service: services.name,
			area: services.area,
			removesTooth: sql<boolean>`coalesce(${services.removesTooth}, false)`.mapWith(Boolean),
			status: procedures.status,
			toothId: procedures.toothId,
			surfaces: procedures.surfaces,
			toothRange: procedures.toothRange,
			fee: procedures.fee,
			completedOn: procedures.completedOn,
			providerId: procedures.providerId,
			provider: providerName,
			appointmentId: procedures.appointmentId,
			visitAt: appointment.startsAt,
			note: procedures.note,
			createdAt: procedures.createdAt
		})
		.from(procedures)
		.leftJoin(services, and(eq(services.id, procedures.serviceId), notDeleted(services)))
		.leftJoin(provider, and(eq(provider.id, procedures.providerId), notDeleted(provider)))
		.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
		.leftJoin(
			appointment,
			and(eq(appointment.id, procedures.appointmentId), notDeleted(appointment))
		)
		.where(and(eq(procedures.patientId, patientId), notDeleted(procedures)))
		.orderBy(
			desc(sql`coalesce(${procedures.completedOn}, ${procedures.createdAt})`),
			desc(procedures.id)
		);
}

/** One row of `chartProcedures`. */
export type ChartProcedureRow = Awaited<ReturnType<typeof chartProcedures>>[number];

/* ── Completing a visit ─────────────────────────────────────────────────────────────────────── */

/**
 * What finishing each of these visits could record: the patient's planned work, and the whole-mouth
 * services the visit's type usually involves (a check-up's consultation and scaling).
 *
 * Only whole-mouth services are offered from the type. A filling or an extraction needs a tooth,
 * which the type cannot know; that is charted on the dental chart, where the tooth is chosen.
 * Planned work is offered whatever its tooth, because the tooth was chosen when it was planned.
 *
 * One query each for the planned work and the usual services, over every visit at once — the day
 * view calls this for the handful that can be completed, not once per appointment.
 */
export async function visitWork(
	visits: { id: number; patientId: number; appointmentTypeId: number | null }[]
) {
	const patientIds = [...new Set(visits.map((v) => v.patientId))];
	const typeIds = [
		...new Set(visits.map((v) => v.appointmentTypeId).filter((t): t is number => t !== null))
	];

	const [planned, usual] = await Promise.all([
		patientIds.length
			? db
					.select({
						id: procedures.id,
						patientId: procedures.patientId,
						appointmentId: procedures.appointmentId,
						service: services.name,
						toothId: procedures.toothId,
						surfaces: procedures.surfaces,
						toothRange: procedures.toothRange,
						fee: procedures.fee
					})
					.from(procedures)
					.leftJoin(services, and(eq(services.id, procedures.serviceId), notDeleted(services)))
					.where(
						and(
							inArray(procedures.patientId, patientIds),
							eq(procedures.status, 'planned'),
							notDeleted(procedures)
						)
					)
					.orderBy(asc(procedures.id))
			: [],
		typeIds.length
			? db
					.select({
						appointmentTypeId: appointmentTypeServices.appointmentTypeId,
						serviceId: services.id,
						name: services.name,
						price: services.price
					})
					.from(appointmentTypeServices)
					.innerJoin(
						services,
						and(
							eq(services.id, appointmentTypeServices.serviceId),
							eq(services.area, 'mouth'),
							eq(services.status, true),
							notDeleted(services)
						)
					)
					.where(
						and(
							inArray(appointmentTypeServices.appointmentTypeId, typeIds),
							notDeleted(appointmentTypeServices)
						)
					)
			: []
	]);

	return new Map(
		visits.map((v) => [
			v.id,
			{
				planned: planned.filter((p) => p.patientId === v.patientId),
				usual: usual.filter((u) => u.appointmentTypeId === v.appointmentTypeId)
			}
		])
	);
}

/** A transaction on the database, as `db.transaction` hands it over. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Records the work done at a visit, in the transaction that completes it: planned procedures
 * marked done, and whole-mouth services added as done. Returns how many procedures it recorded.
 *
 * Everything is dated to **the visit's day**, not today, so a visit closed the next morning still
 * files its work on the day it happened, and linked to the visit, which is what an invoice will be
 * raised from. The dentist is the procedure's own when it has one, else the visit's; work with
 * neither is refused, since production is counted per dentist.
 *
 * Ids are re-checked here rather than trusted: a planned procedure must be this patient's and still
 * planned, and a service must be an active whole-mouth one. Anything else means the dialog was
 * stale, and the whole completion is refused rather than half-recorded.
 */
export async function recordVisitWork(
	tx: Tx,
	event: AuditRequest,
	visit: {
		id: number;
		patientId: number;
		providerId: number | null;
		branchId: number | null;
		startsAt: Date;
	},
	chosen: { procedureIds: number[]; serviceIds: number[] }
): Promise<number> {
	const day = clinicDate(visit.startsAt);
	const userId = event.locals.user?.id;
	let recorded = 0;

	if (chosen.procedureIds.length) {
		const rows = await tx
			.select()
			.from(procedures)
			.where(
				and(
					inArray(procedures.id, chosen.procedureIds),
					eq(procedures.patientId, visit.patientId),
					eq(procedures.status, 'planned'),
					notDeleted(procedures)
				)
			);
		if (rows.length !== new Set(chosen.procedureIds).size) {
			throw new WriteRefused(null, 'Some of that planned work has changed. Reopen the visit.');
		}

		for (const row of rows) {
			const providerId = row.providerId ?? visit.providerId;
			if (providerId === null) {
				throw new WriteRefused(null, 'Assign a dentist to the visit before recording its work.');
			}
			const written = {
				status: 'completed' as const,
				completedOn: day,
				appointmentId: visit.id,
				providerId,
				updatedBy: userId
			};
			await tx.update(procedures).set(written).where(eq(procedures.id, row.id));
			await recordAudit(tx, event, {
				table: 'procedures',
				recordId: row.id,
				action: 'update',
				before: row,
				after: written
			});
			recorded++;
		}
	}

	if (chosen.serviceIds.length) {
		const found = await tx
			.select({ id: services.id, price: services.price })
			.from(services)
			.where(
				and(
					inArray(services.id, chosen.serviceIds),
					eq(services.area, 'mouth'),
					eq(services.status, true),
					notDeleted(services)
				)
			);
		if (found.length !== new Set(chosen.serviceIds).size) {
			throw new WriteRefused(null, 'One of those services is no longer offered. Reopen the visit.');
		}
		if (visit.providerId === null) {
			throw new WriteRefused(null, 'Assign a dentist to the visit before recording its work.');
		}

		for (const service of found) {
			const id = await insertReturningId(tx, procedures, {
				patientId: visit.patientId,
				appointmentId: visit.id,
				serviceId: service.id,
				providerId: visit.providerId,
				branchId: visit.branchId ?? undefined,
				status: 'completed',
				fee: service.price,
				completedOn: day,
				createdBy: userId
			});
			await recordAudit(tx, event, { table: 'procedures', recordId: id, action: 'create' });
			recorded++;
		}
	}

	return recorded;
}
