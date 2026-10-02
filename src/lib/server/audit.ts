/**
 * The audit chokepoint: a change to audited data is recorded here, in the same transaction.
 *
 * `AUDIT.md` is the specification and carries the measurements; this is the helper it describes.
 * The rules it enforces, in the order they are most likely to be broken:
 *
 *   - **Only listed tables.** `AuditedTable` is a closed union, so auditing an unlisted table is a
 *     compile error and so is forgetting to decide. Lookup tables are deliberately absent — they
 *     carry `updatedBy`/`updatedAt` on the row, which answers the same question for free.
 *   - **The delta, never the row.** `changes` holds `{ field: [before, after] }` for the fields
 *     that moved. A create or a delete writes no `changes` at all: the row itself is the story, and
 *     it is still sitting in its own table. Measured at 179 bytes a row against 5,474 for
 *     snapshots, and the 128 MB buffer pool is what makes that difference decisive.
 *   - **Never a secret.** A field that looks like a credential records that it changed, not to
 *     what. An audit row is a second copy of whatever it holds, in a table nobody watches.
 *   - **Same transaction.** Pass the `tx` the change was written with. An audit row committed on
 *     its own can disagree with the data, and a log that disagrees is worse than none.
 *
 * Non-goals: reads (that is `patient_access_log`), and bulk operations row by row — a payroll run
 * over 400 employees is one call describing the run, not 400.
 */
import type { db } from '$lib/server/db';
import { auditLog } from '$lib/server/db/schema';

/** The database or a transaction on it. Pass the transaction the audited change was written in. */
type Writer = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Every table whose changes are audited — `AUDIT.md`'s list, as a type.
 *
 * Adding a table here is a decision about cost as much as about evidence: each audited write
 * costs about a millisecond and a row. High-churn tables with no evidentiary value stay off.
 */
export type AuditedTable =
	// the patient and their clinical children
	| 'patient'
	| 'patient_allergies'
	| 'patient_conditions'
	| 'patient_medications'
	| 'patient_contacts'
	| 'patient_emergency_contacts'
	| 'patient_consent'
	| 'patient_file'
	// the clinical record
	| 'clinical_note'
	| 'procedures'
	| 'prescription'
	| 'prescription_item'
	| 'treatment_plan'
	| 'treatment_plan_item'
	| 'lab_case'
	| 'appointment'
	// money
	| 'invoice'
	| 'invoice_line'
	| 'invoice_payment'
	| 'transactions'
	| 'expenses'
	| 'cash_session'
	// pay adjustments: each changes what an employee is paid (`server/payrollLedger.ts`)
	| 'over_time'
	| 'bonuses'
	| 'deductions'
	| 'attendance'
	// controlled stock
	| 'supplies_adjustments'
	| 'supply_batch'
	| 'damaged_supplies'
	// who may do what
	| 'user'
	| 'roles'
	| 'role_permissions'
	| 'special_permissions'
	| 'employee'
	// credentials the clinic stores for others' services (`server/secrets.ts`): the key itself is
	// redacted by name, so the row says only that it changed, and who changed it
	| 'sms_provider';

/** What happened. `varchar(20)` in the table; the union is the enforcement (see AUDIT.md). */
export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'merge';

/** A row, or the part of one being written, keyed by Drizzle property name. */
type Row = Record<string, unknown>;

/** `{ field: [before, after] }` for the fields that moved. */
export type AuditChanges = Record<string, [unknown, unknown]>;

/**
 * Bookkeeping every `secureFields` table stamps on each write. They always "change", and recording
 * them would double the size of every audit row to say what the row's own columns already say.
 */
const BOOKKEEPING = new Set(['updatedAt', 'updatedBy', 'createdAt', 'createdBy']);

/**
 * Field names that hold a credential. Matched by name rather than listed per table, because the
 * failure this guards is a *new* column nobody thought to add to a list.
 */
const SECRET = /pass(word)?|secret|token|hash|api_?key|credential/i;

const REDACTED = '[redacted]';

/**
 * One value, in the form two sides of a comparison can agree on.
 *
 * A form posts `'2026-09-01'` for a date the database hands back as a `Date` at local midnight;
 * compared raw, every save of an unchanged date would record a change. Empty strings and
 * `undefined` are the form's way of saying null.
 */
function normalise(value: unknown): unknown {
	if (value === undefined || value === '') return null;

	if (value instanceof Date) {
		const pad = (n: number) => String(n).padStart(2, '0');

		/*
		 * A `date` column comes back as midnight — but whose midnight depends on the driver's
		 * timezone setting, and on this server it is UTC while the process runs at UTC+3. Checking
		 * only local midnight recorded every save of an unchanged birth date as
		 * `["1992-01-01T00:00:00.000Z", "1992-01-01"]`. Either midnight means a date-only value.
		 */
		if (
			value.getUTCHours() === 0 &&
			value.getUTCMinutes() === 0 &&
			value.getUTCSeconds() === 0 &&
			value.getUTCMilliseconds() === 0
		) {
			return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
		}
		if (
			value.getHours() === 0 &&
			value.getMinutes() === 0 &&
			value.getSeconds() === 0 &&
			value.getMilliseconds() === 0
		) {
			return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
		}

		return value.toISOString();
	}

	return value;
}

/**
 * The fields of `after` that differ from `before`, redacted where they must be.
 *
 * Only keys present in `after` are compared: an update writes some columns, and a column it did
 * not touch has not changed no matter what the old row says about it.
 */
export function auditChanges(before: Row, after: Row): AuditChanges {
	const changes: AuditChanges = {};

	for (const [field, raw] of Object.entries(after)) {
		if (BOOKKEEPING.has(field)) continue;

		const was = normalise(before[field]);
		const now = normalise(raw);
		if (was === now) continue;
		// Numbers from a form can arrive as strings; `5` and `'5'` are not a change.
		if (was !== null && now !== null && String(was) === String(now)) continue;

		changes[field] = SECRET.test(field) ? [REDACTED, REDACTED] : [was, now];
	}

	return changes;
}

export type AuditEntry = {
	table: AuditedTable;
	recordId: string | number;
	action: AuditAction;
	/**
	 * For an update: the row as it was, and the values written. Only the difference is stored.
	 * Omit both for a create or a delete.
	 */
	before?: Row;
	after?: Row;
	/**
	 * Something describing an operation that is not a field change — a merge's source record, a
	 * bulk run's size. Stored in `changes` as-is, so keep it small and never put a row in it.
	 */
	detail?: Record<string, unknown>;
};

/**
 * Records one audited change. Call it with the transaction the change was written in.
 *
 *     await db.transaction(async (tx) => {
 *       await tx.update(patient).set(values).where(eq(patient.id, id));
 *       await recordAudit(tx, event, { table: 'patient', recordId: id, action: 'update', before, after: values });
 *     });
 *
 * An update whose values match the row writes nothing — a save with no edits is not an event.
 * Returns whether a row was written.
 */
/**
 * The parts of a request an audit row is stamped from: who, where, and from which address.
 *
 * Named, rather than a whole `RequestEvent`, so a write can be audited — and tested — with exactly
 * what it records. A `RequestEvent` is one of these.
 */
export type AuditRequest = {
	locals: { user?: { id: string } | null; branch?: { active: number | null } };
	getClientAddress: () => string;
};

export async function recordAudit(
	writer: Writer,
	event: AuditRequest,
	entry: AuditEntry
): Promise<boolean> {
	let changes: Record<string, unknown> | null = null;

	if (entry.action === 'update' && entry.before && entry.after) {
		const delta = auditChanges(entry.before, entry.after);
		if (!Object.keys(delta).length && !entry.detail) return false;
		changes = delta;
	}

	if (entry.detail) changes = { ...(changes ?? {}), ...entry.detail };

	await writer.insert(auditLog).values({
		userId: event.locals.user?.id ?? null,
		action: entry.action,
		tableName: entry.table,
		recordId: String(entry.recordId),
		changes,
		ipAddress: clientAddress(event),
		branchId: event.locals.branch?.active ?? null
	});

	return true;
}

/**
 * The caller's address, or null where the adapter cannot say — a prerender, a test harness. An
 * audit row without an address is still evidence; refusing the write over it would lose the
 * change's record entirely.
 */
function clientAddress(event: Pick<AuditRequest, 'getClientAddress'>): string | null {
	try {
		return event.getClientAddress().slice(0, 45);
	} catch {
		return null;
	}
}
