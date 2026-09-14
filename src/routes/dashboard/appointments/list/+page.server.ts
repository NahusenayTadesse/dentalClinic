import { and, count, desc, eq, gte, isNull, lt, sql, type SQL } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { appointment, appointmentType, operatory, patient, provider } from '$lib/server/db/schema';
import { branchFilter } from '$lib/server/branchScope';
import { notDeleted } from '$lib/server/softDelete';
import {
	buildWhere,
	currentQuery,
	facetCounts,
	orderBy,
	pagination,
	parseTableQuery
} from '$lib/server/queryFilters';
import { patientFullName, patientSearch } from '$lib/server/patients';
import { appointmentQuery, providerName } from '$lib/server/appointments';
import { alias } from 'drizzle-orm/mysql-core';
import { employee } from '$lib/server/db/schema';
import { APPOINTMENT_STATUSES, STATUS_LABEL, isAppointmentStatus } from '$lib/appointmentStatus';
import { clinicDayRange, isIsoDate } from '$lib/clinicTime';
import type { PageServerLoad } from './$types';

/**
 * The date window, as clinic-local days.
 *
 * Not `buildWhere`'s `dateColumn`: that builds the end of the day with the server process's clock,
 * which on a `datetime` stored as UTC puts the boundary three hours off, and the last evening's
 * appointments fall out of "today". The window is from the clinic's midnight on the first day to its
 * midnight after the last.
 */
function clinicWindow(start: string | null, end: string | null) {
	if (!isIsoDate(start) || !isIsoDate(end)) return undefined;
	return and(
		gte(appointment.startsAt, clinicDayRange(start).start),
		lt(appointment.startsAt, clinicDayRange(end).end)
	);
}

/**
 * Every appointment, as a searchable, filterable list — the question the day view cannot answer:
 * "when is Abebe's next visit", "how many no-shows did Dr Tesfaye have last month".
 *
 * Branch scoped like every other list of branch-scoped rows (`BRANCH_SCOPED`, CLAUDE.md §15), and
 * — unlike the day view — useful when seeing every branch, which is why the day view sends people
 * here when no branch is chosen.
 *
 * The search is the patient search (`patientSearch`): names in any order, file number, any phone.
 * Each row points at the day view on its date, with the appointment open.
 */

const SORTABLE = {
	when: appointment.startsAt,
	patient: patientFullName,
	status: appointment.status,
	type: appointmentType.name,
	chair: operatory.name
};

const FILTERS = ['status', 'typeId', 'providerId', 'chairId', 'flag'] as const;

export const load: PageServerLoad = async ({ url, locals }) => {
	const query = parseTableQuery(url, FILTERS, 20, Object.keys(SORTABLE));

	const spec = {
		base: [
			notDeleted(appointment),
			branchFilter(appointment.branchId, locals.branch),
			clinicWindow(query.dateStart, query.dateEnd)
		],
		search: patientSearch,
		filters: {
			status: (v: string) => (isAppointmentStatus(v) ? eq(appointment.status, v) : sql`false`),
			typeId: (v: string) =>
				v === 'none'
					? isNull(appointment.appointmentTypeId)
					: eq(appointment.appointmentTypeId, Number(v)),
			providerId: (v: string) =>
				v === 'none' ? isNull(appointment.providerId) : eq(appointment.providerId, Number(v)),
			chairId: (v: string) =>
				v === 'none' ? isNull(appointment.operatoryId) : eq(appointment.operatoryId, Number(v)),
			flag: (v: string) =>
				v === 'new'
					? eq(appointment.isNewPatient, true)
					: v === 'asap'
						? eq(appointment.isAsap, true)
						: sql`false`
		}
	};

	const where = buildWhere(query, spec);

	const [{ total }] = await db
		.select({ total: count() })
		.from(appointment)
		.innerJoin(patient, eq(patient.id, appointment.patientId))
		.where(where);

	const rows = await appointmentQuery(where)
		.orderBy(...(orderBy(query, SORTABLE) ?? [desc(appointment.startsAt)]), desc(appointment.id))
		.limit(query.limit)
		.offset(query.offset);

	const providerEmployee = alias(employee, 'provider_employee');

	type FilterKey = (typeof FILTERS)[number];
	const tally = (
		value: SQL<string | number | null>,
		label: SQL<string | null>,
		except: FilterKey
	) =>
		db
			.select({ value, label, count: count() })
			.from(appointment)
			.innerJoin(patient, eq(patient.id, appointment.patientId))
			.leftJoin(appointmentType, eq(appointmentType.id, appointment.appointmentTypeId))
			.leftJoin(operatory, eq(operatory.id, appointment.operatoryId))
			.leftJoin(provider, eq(provider.id, appointment.providerId))
			.leftJoin(providerEmployee, eq(providerEmployee.id, provider.employeeId))
			.where(buildWhere(query, spec, { except }))
			.groupBy(value, label);

	const facets = await facetCounts({
		status: async () =>
			(
				await tally(
					sql<string>`${appointment.status}`,
					sql<string>`${appointment.status}`,
					'status'
				)
			).map((r) => ({
				...r,
				label: isAppointmentStatus(r.value) ? STATUS_LABEL[r.value].label : String(r.value)
			})),
		type: () =>
			tally(
				sql<string>`coalesce(${appointmentType.id}, 'none')`,
				sql<string>`coalesce(${appointmentType.name}, 'Not given')`,
				'typeId'
			),
		provider: () =>
			tally(
				sql<string>`coalesce(${provider.id}, 'none')`,
				sql<string>`coalesce(${providerName}, 'Not assigned')`,
				'providerId'
			),
		chair: () =>
			tally(
				sql<string>`coalesce(${operatory.id}, 'none')`,
				sql<string>`coalesce(${operatory.name}, 'No chair')`,
				'chairId'
			),
		flags: async () => {
			const counted = async (
				flag: 'new' | 'asap',
				label: string,
				column: 'isNewPatient' | 'isAsap'
			) => {
				const [row] = await db
					.select({ count: count() })
					.from(appointment)
					.innerJoin(patient, eq(patient.id, appointment.patientId))
					.where(and(buildWhere(query, spec, { except: 'flag' }), eq(appointment[column], true)));
				return { value: flag, label, count: Number(row?.count ?? 0) };
			};
			return Promise.all([
				counted('new', 'First visit', 'isNewPatient'),
				counted('asap', 'Short notice', 'isAsap')
			]);
		}
	});

	return {
		appointments: rows,
		facets,
		statuses: APPOINTMENT_STATUSES,
		pagination: pagination(query, total),
		currentQuery: currentQuery(query)
	};
};
