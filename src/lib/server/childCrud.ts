import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod/v4';
import type { RequestEvent } from '@sveltejs/kit';
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';

import { db } from '$lib/server/db';
import { saveUploadedFile } from '$lib/server/upload';
import { notDeleted, softDeleteOwnedRecord } from '$lib/server/softDelete';

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

/** A child table: an id, a soft-delete marker, and a column naming its owner. */
type ChildTable = MySqlTable & Record<string, MySqlColumn>;
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
	 */
	transform?: (values: WritableRow, event: RequestEvent) => WritableRow | Promise<WritableRow>;
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
	transform
}: ChildCrudOptions) {
	const owner = table[ownerColumn];
	if (!owner) throw new Error(`childCrud: ${ownerColumn} is not a column on this table`);

	const hasSecureFields = 'isActive' in table;

	const toRow = async (data: Record<string, unknown>) => {
		// `id` names the row, never a column to write.
		const values = { ...data };
		delete values.id;

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

			return { addForm, editForm, deleteForm, rows };
		},

		actions: {
			add: async (event: RequestEvent, ownerId: number) => {
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

					await db.insert(table).values(values as never);
					return message(form, { type: 'success', text: `${label} added` });
				} catch (err) {
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
					let values = await toRow(form.data);
					if (hasSecureFields) values.updatedBy = event.locals.user?.id;
					if (transform) values = await transform(values, event);

					// The owner is in the `where`, not the `set`: an edit may never move a row to a
					// different parent, and a row id from another parent must match nothing.
					await db
						.update(table)
						.set(values as never)
						.where(and(eq(table.id, rowId), eq(owner, ownerId), notDeleted(table as never)));

					return message(form, { type: 'success', text: `${label} updated` });
				} catch (err) {
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
				const form = await superValidate(event.request, zod4(idSchema));

				if (!form.valid) {
					return message(form, { type: 'error', text: 'Invalid request' }, { status: 400 });
				}

				try {
					const removed = await db.transaction((tx) =>
						softDeleteOwnedRecord(
							tx,
							table as never,
							owner,
							form.data.id,
							ownerId,
							event.locals.user?.id
						)
					);

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

/** MySQL's unique-constraint violation. */
function isDuplicateKey(err: unknown): boolean {
	return (err as { code?: string })?.code === 'ER_DUP_ENTRY';
}
