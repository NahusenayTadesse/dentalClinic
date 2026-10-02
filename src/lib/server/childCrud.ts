import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import type { RequestEvent } from '@sveltejs/kit';
import type { MySqlTable } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import { isDuplicateKey } from '@nahu/admin-kit/server/dbErrors.js';
import { saveUploadedFile } from '$lib/server/upload';
import { notDeleted, softDeleteOwnedRecord } from '$lib/server/softDelete';
import { recordAudit, type AuditedTable } from '$lib/server/audit';
import { insertReturningId } from '$lib/server/db/insert';
import { requirePermission, requireSuperAdmin } from '$lib/server/permissions';

/**
 * CRUD for a table of rows owned by one parent record — the tabs on a detail page.
 *
 * `contentCrud` manages a table that stands alone; this manages one that belongs to something.
 * The difference is not cosmetic and is the whole reason this exists separately:
 *
 *   - every read is scoped to the owner, so one patient's rows can never appear under another
 *   - the owning id is stamped **server-side** on insert, never taken from the form
 *   - the delete matches the owner column as well as the row id, so a guessed id from another
 *     parent finds nothing (`softDeleteOwnedRecord` already worked this way; this wires the
 *     rest of the round trip to it)
 *
 * The employee detail page is eight of these written out by hand — `Families`, `experience`,
 * `qualifications`, `accounts` and `contacts` are 45–75% identical to each other. `staffOwnedTables`
 * in `softDelete.ts` is the same registry from the delete side.
 *
 * Non-goals: a child table with its own sub-children, or one whose rows need approving. Those
 * keep their own page.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A child table: an id, a soft-delete marker, and a column naming its owner.
 *
 * `Record<string, any>` rather than `Record<string, MySqlColumn>`, which is what this said until
 * the first caller tried to use it — a concrete Drizzle table has no index signature, so no real
 * table was assignable and the helper could not be called at all. That is why it shipped with
 * zero consumers and nothing noticed. `crud.ts` names the same escape for the same reason
 * (CLAUDE.md §3): Drizzle does not expose columns by index, and this is generic over arbitrary
 * tables by design.
 */
type ChildTable = MySqlTable & Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */
type AnySchema = z.ZodType<Record<string, unknown>>;

/**
 * The row on its way into `insert().values()` or `update().set()`.
 *
 * Assembled at runtime from form data and the owner stamp, so no static type describes it.
 * Named rather than cast inline, per CLAUDE.md §3.
 */
type WritableRow = Record<string, unknown>;

export interface ChildCrudOptions {
	/** The child table being managed. */
	table: ChildTable;
	/** The column on `table` holding the owner's id — `staffId`, `patientId`. */
	ownerColumn: string;
	/** Singular, human readable, for toasts and the delete prompt. */
	label: string;
	addSchema: AnySchema;
	editSchema: AnySchema;
	/** Fields holding an uploaded File; saved to disk, stored as a filename. */
	fileFields?: string[];
	/**
	 * Runs after the form is validated and before the write, for columns the server must decide.
	 * The owner id is already stamped by the time this is called.
	 *
	 * On an edit, `before` is the row as it stands, read in the write's own transaction — for a
	 * column that should change only when something else does, like a resolved date that is set
	 * the first time a condition is marked resolved and left alone on every save after.
	 *
	 * Throw `WriteRefused` to turn the write down with a reason; nothing is written.
	 */
	transform?: (
		values: WritableRow,
		event: RequestEvent,
		before?: WritableRow
	) => WritableRow | Promise<WritableRow>;
	/**
	 * The audit name of `table`, when its changes are audited (CLAUDE.md §11).
	 *
	 * Given, every add, edit and delete runs in a transaction with its audit row. Named here rather
	 * than read off the Drizzle table so the closed `AuditedTable` list is what decides, and an
	 * unlisted table cannot be audited by accident — or skipped by one.
	 */
	audit?: AuditedTable;
	/**
	 * The permission a write needs beyond the route's own gate (CLAUDE.md §9).
	 *
	 * The route rule decides who may *open* the parent's page. Changing what is on it can be a
	 * different privilege — a receptionist reads a patient's allergy list and a clinician changes
	 * it — and the action is reachable by anyone who can POST to the page, so it is checked here.
	 */
	permission?: string;
	/**
	 * Deleting a row needs a super admin, whatever `permission` says. For a child row whose history
	 * is the point — a consent is withdrawn, not deleted, and a deleted one reads as though it was
	 * never given — so the delete exists only for a row entered on the wrong patient.
	 */
	superAdminDelete?: boolean;
}

/**
 * Thrown by a `transform` to refuse a write with a reason the user can act on.
 *
 * A transform is where the server checks what the form cannot: that a filling names the surfaces
 * it was on, when only the database knows the chosen service is charted on surfaces. Before this,
 * the only way out of a transform was an ordinary throw, which the action reports as "Could not
 * add" with a 500, so a rule the user broke read as a fault in the system.
 *
 * `field` puts the message under that input; `null` shows it as a message on the form alone.
 */
export class WriteRefused extends Error {
	constructor(
		readonly field: string | null,
		message: string
	) {
		super(message);
		this.name = 'WriteRefused';
	}
}

/**
 * Refuses a write unless `ok`, with a reason for the person — the one-line guard every write module
 * starts with. It was written out in three of them before it lived here.
 */
export function refuseUnless(ok: boolean, text: string, field: string | null = null): asserts ok {
	if (!ok) throw new WriteRefused(field, text);
}

/** The form's response to a `WriteRefused`: the reason under its field, and a 400. */
function refused(form: Parameters<typeof message>[0], err: WriteRefused) {
	if (err.field) setError(form, err.field as never, err.message);
	return message(form, { type: 'error', text: err.message }, { status: 400 });
}

/** Every child action needs the row and, on edit and delete, which row. */
const idSchema = z.object({ id: z.coerce.number() });

export function childCrud({
	table,
	ownerColumn,
	label,
	addSchema,
	editSchema,
	fileFields = [],
	transform,
	audit,
	permission,
	superAdminDelete = false
}: ChildCrudOptions) {
	const owner = table[ownerColumn];
	if (!owner) throw new Error(`childCrud: ${ownerColumn} is not a column on this table`);

	const hasSecureFields = 'isActive' in table;

	const toRow = async (data: Record<string, unknown>) => {
		// `id` names the row, never a column to write.
		const values = { ...data };
		delete values.id;

		/*
		 * Forms across the app call the active flag `status`; `secureFields` tables call the column
		 * `isActive`, and the layouts read it back under the `status` alias. `contentCrud` has mapped
		 * this since the toggle was found silently doing nothing — Drizzle drops keys that match no
		 * column, so the row saved and `is_active` kept its default. This factory did not, and every
		 * section on the employee page had to repeat the rename in its own `transform`. One place,
		 * the same as its sibling.
		 */
		if ('status' in values && !('status' in table) && 'isActive' in table) {
			values.isActive = values.status;
			delete values.status;
		}

		for (const field of fileFields) {
			const file = values[field];
			// No new upload means "keep whatever is already stored".
			if (file instanceof File && file.size > 0) {
				values[field] = await saveUploadedFile(file);
			} else {
				delete values[field];
			}
		}

		return values as WritableRow;
	};

	return {
		/**
		 * This owner's rows, plus the three forms the section needs.
		 *
		 * Takes the owner id rather than reading it from the URL: a detail page loads several of
		 * these and the parent is already resolved by the time it does.
		 */
		load: async (ownerId: number) => {
			const [addForm, editForm, deleteForm, rows] = await Promise.all([
				superValidate(zod4(addSchema)),
				superValidate(zod4(editSchema)),
				superValidate(zod4(idSchema)),
				db
					.select()
					.from(table)
					.where(and(eq(owner, ownerId), notDeleted(table as never)))
					.orderBy(asc(table.id))
			]);

			// Every child table is keyed by an int `id`; saying so here is what lets the section's
			// table component take the rows without each page restating it.
			return {
				addForm,
				editForm,
				deleteForm,
				rows: rows.map((row) => ({ ...row, id: Number(row.id) }))
			};
		},

		actions: {
			add: async (event: RequestEvent, ownerId: number) => {
				if (permission) requirePermission(event.locals, permission);
				const form = await superValidate(event.request, zod4(addSchema));

				if (!form.valid) {
					return message(
						form,
						{ type: 'error', text: 'Please check the form for errors' },
						{ status: 400 }
					);
				}

				try {
					let values = await toRow(form.data);
					// Stamped here, never read off the form: a client that posts its own owner id
					// would otherwise file the row under somebody else's parent.
					values[ownerColumn] = ownerId;
					if (hasSecureFields) values.createdBy = event.locals.user?.id;
					if (transform) values = await transform(values, event);

					const written = values;
					if (audit) {
						// The id is only needed to say which row the audit entry is about.
						await db.transaction(async (tx) => {
							const id = await insertReturningId(tx, table, written);
							await recordAudit(tx, event, { table: audit, recordId: id, action: 'create' });
						});
					} else {
						await db.insert(table).values(written as never);
					}
					return message(form, { type: 'success', text: `${label} added` });
				} catch (err) {
					if (err instanceof WriteRefused) return refused(form, err);
					if (isDuplicateKey(err)) {
						setError(form, 'name' as never, `That ${label.toLowerCase()} already exists.`);
						return message(
							form,
							{ type: 'error', text: `That ${label.toLowerCase()} already exists.` },
							{ status: 400 }
						);
					}

					console.error(`Failed to add ${label}:`, err);
					return message(form, { type: 'error', text: `Could not add ${label}` }, { status: 500 });
				}
			},

			edit: async (event: RequestEvent, ownerId: number) => {
				if (permission) requirePermission(event.locals, permission);
				const form = await superValidate(event.request, zod4(editSchema));

				if (!form.valid) {
					return message(
						form,
						{ type: 'error', text: 'Please check the form for errors' },
						{ status: 400 }
					);
				}

				try {
					const rowId = Number(form.data.id);
					const values = await toRow(form.data);
					if (hasSecureFields) values.updatedBy = event.locals.user?.id;

					// The owner is in the `where`, not the `set`: an edit may never move a row to a
					// different parent, and a row id from another parent must match nothing.
					const scope = and(eq(table.id, rowId), eq(owner, ownerId), notDeleted(table as never));

					const found = await db.transaction(async (tx) => {
						// Read first, in the same transaction: the audit row needs what changed, and a row
						// that is not this owner's must say so rather than report a save that matched nothing.
						const [before] = await tx.select().from(table).where(scope).limit(1);
						if (!before) return false;

						const written = transform ? await transform(values, event, before) : values;

						await tx
							.update(table)
							.set(written as never)
							.where(scope);

						if (audit) {
							await recordAudit(tx, event, {
								table: audit,
								recordId: rowId,
								action: 'update',
								before,
								after: written
							});
						}
						return true;
					});

					return found
						? message(form, { type: 'success', text: `${label} updated` })
						: message(
								form,
								{ type: 'error', text: `That ${label.toLowerCase()} no longer exists.` },
								{ status: 404 }
							);
				} catch (err) {
					if (err instanceof WriteRefused) return refused(form, err);
					console.error(`Failed to update ${label}:`, err);
					return message(
						form,
						{ type: 'error', text: `Could not update ${label}` },
						{ status: 500 }
					);
				}
			},

			/**
			 * Soft delete, scoped to the owner.
			 *
			 * Deliberately not gated on super admin, unlike `contentCrud`: a lookup table is
			 * configuration the whole system reads, while these rows belong to one record and are
			 * maintained by whoever maintains that record. The route's own `routeRules` entry is
			 * what decides who that is.
			 */
			delete: async (event: RequestEvent, ownerId: number) => {
				if (permission) requirePermission(event.locals, permission);
				if (superAdminDelete) requireSuperAdmin(event.locals);
				const form = await superValidate(event.request, zod4(idSchema));

				if (!form.valid) {
					return message(form, { type: 'error', text: 'Invalid request' }, { status: 400 });
				}

				try {
					const removed = await db.transaction(async (tx) => {
						const done = await softDeleteOwnedRecord(
							tx,
							table as never,
							owner,
							form.data.id,
							ownerId,
							event.locals.user?.id
						);

						if (done && audit) {
							await recordAudit(tx, event, {
								table: audit,
								recordId: form.data.id,
								action: 'delete'
							});
						}
						return done;
					});

					return removed
						? message(form, { type: 'success', text: `${label} deleted` })
						: message(
								form,
								{ type: 'error', text: `That ${label.toLowerCase()} no longer exists.` },
								{ status: 404 }
							);
				} catch (err) {
					console.error(`Failed to delete ${label}:`, err);
					return message(
						form,
						{ type: 'error', text: `Could not delete ${label}` },
						{ status: 500 }
					);
				}
			}
		}
	};
}

/**
 * The form actions for a page's child sections, generated rather than written out.
 *
 *     export const actions = {
 *       ...childActions({ Allergy: allergies, Condition: conditions }, livePatientId),
 *       editIdentity: …
 *     };
 *
 * gives `addAllergy`, `editAllergy`, `deleteAllergy`, `addCondition` and so on — the names
 * `childActionPaths` on the client posts to, so the two halves are spelled from one key.
 *
 * The employee page wrote its twelve of these by hand, one line each, and every line took the
 * owner straight off the URL. `owner` is a function here for the reason that was wrong: a POST to
 * a record that does not exist, or a merged patient's tombstone, must be refused before a child
 * row is filed under it — a foreign key error is not a refusal, it is a 500.
 */
export function childActions<K extends string, E extends RequestEvent>(
	sections: Record<K, ReturnType<typeof childCrud>>,
	/** Generic over the route's own event type, so a route can pass a resolver typed to its params. */
	owner: (event: E) => Promise<number>
) {
	const actions: Record<string, (event: E) => Promise<unknown>> = {};

	for (const [key, section] of Object.entries(sections) as [K, ReturnType<typeof childCrud>][]) {
		actions[`add${key}`] = async (event) => section.actions.add(event, await owner(event));
		actions[`edit${key}`] = async (event) => section.actions.edit(event, await owner(event));
		actions[`delete${key}`] = async (event) => section.actions.delete(event, await owner(event));
	}

	return actions;
}
