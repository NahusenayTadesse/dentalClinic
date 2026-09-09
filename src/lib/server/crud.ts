import { superValidate, message } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import type { RequestEvent } from '@sveltejs/kit';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import { db } from '$lib/server/db';
import { saveUploadedFile } from '$lib/server/upload';
import { requireSuperAdmin } from '$lib/server/permissions';
import { notDeleted } from '$lib/server/softDelete';

/** Every content table is keyed by an autoincrement id. */
export const idSchema = z.object({ id: z.coerce.number() });

/** Reused by every content form: an integer that decides display order. */
export const sortOrderField = z.coerce.number().int().min(0).default(0);

/** A content table, plus index access to its columns for the generic helpers. */
type AnyTable = MySqlTable & Record<string, any>;
type AnySchema = z.ZodType<any, any>;
/** Validated form data always carries the row's own columns, and an id on edit. */
type FormData = Record<string, any> & { id: number };

interface CrudOptions {
	/** The Drizzle table being managed. */
	table: AnyTable;
	/** Singular, human-readable name used in toast messages, e.g. "Farm". */
	label: string;
	addSchema: AnySchema;
	editSchema: AnySchema;
	/** Fields holding an uploaded File; saved to disk and stored as a filename. */
	fileFields?: string[];
	/** Fields entered as one-per-line text and stored as a JSON string array. */
	listFields?: string[];
	/**
	 * Runs after `toRow`, before insert/update, for both add and edit. Use it
	 * to set columns that must come from the server rather than the client
	 * (e.g. `finalizedByUserId: event.locals.user?.id`) — never trust a
	 * privileged field the form itself could submit.
	 */
	transform?: (
		values: Record<string, any>,
		event: RequestEvent
	) => Record<string, any> | Promise<Record<string, any>>;
}

/**
 * Builds the `load` and `actions` for a content table's dashboard page.
 *
 * Every content page needs the same three forms and the same add/edit/delete
 * round trip, so the only thing a route has to supply is its schemas and the
 * handful of fields that need special treatment (files, JSON lists).
 */
export function contentCrud({
	table,
	label,
	addSchema,
	editSchema,
	fileFields = [],
	listFields = [],
	transform
}: CrudOptions) {
	/** Newest content sorts by the admin-chosen order; the rest falls back to id. */
	const orderColumn = table.sortOrder ?? table.id;

	/**
	 * Content tables never hard-delete: `secureFields` tables track
	 * `isActive`/`deletedAt`/`deletedBy`, `lesserFields` tables track just
	 * `status`. Every existing page in this app filters lists and "deletes"
	 * rows by flipping one of these instead of removing the row (rows are
	 * frequently referenced elsewhere via non-cascading foreign keys).
	 */
	const activeColumn = table.isActive ?? table.status;
	const hasSecureFields = 'isActive' in table;
	const isSoftDeletable = 'deletedAt' in table;

	/** Turns validated form data into a row, minus anything that must not change. */
	const toRow = async (data: Record<string, any>) => {
		const { id, ...values } = data;

		for (const field of fileFields) {
			const file = values[field];
			// No new upload means "keep whatever is already stored".
			if (file instanceof File && file.size > 0) {
				values[field] = await saveUploadedFile(file);
			} else {
				delete values[field];
			}
		}

		for (const field of listFields) {
			const raw = values[field];
			values[field] =
				typeof raw === 'string'
					? raw
							.split('\n')
							.map((line) => line.trim())
							.filter(Boolean)
					: (raw ?? []);
		}

		return values;
	};

	const load = async () => {
		const base = db.select().from(table);
		// Deleted rows are excluded independently of `isActive`/`status`: those are
		// business state, this is the delete marker.
		const conditions = [
			...(activeColumn ? [eq(activeColumn, true)] : []),
			...(isSoftDeletable ? [notDeleted(table as never)] : [])
		];
		const query = (conditions.length ? base.where(and(...conditions)) : base).orderBy(
			asc(orderColumn)
		);

		const [addForm, editForm, deleteForm, rows] = await Promise.all([
			superValidate(zod4(addSchema)),
			superValidate(zod4(editSchema)),
			superValidate(zod4(idSchema)),
			query
		]);

		return { addForm, editForm, deleteForm, rows };
	};

	const actions = {
		add: async (event: RequestEvent) => {
			const { request, locals } = event;
			const form = await superValidate(request, zod4(addSchema));
			if (!form.valid) {
				return message(
					form,
					{ type: 'error', text: 'Please check the form for errors' },
					{ status: 400 }
				);
			}

			try {
				let values = await toRow(form.data as FormData);
				if (hasSecureFields) values.createdBy = locals.user?.id;
				if (transform) values = await transform(values, event);
				await db.insert(table).values(values);
				return message(form, { type: 'success', text: `${label} added` });
			} catch (err) {
				console.error(`Failed to add ${label}:`, err);
				return message(form, { type: 'error', text: `Could not add ${label}` }, { status: 500 });
			}
		},

		edit: async (event: RequestEvent) => {
			const { request, locals } = event;
			const form = await superValidate(request, zod4(editSchema));
			if (!form.valid) {
				return message(
					form,
					{ type: 'error', text: 'Please check the form for errors' },
					{ status: 400 }
				);
			}

			try {
				const data = form.data as FormData;
				let values = await toRow(data);
				if (hasSecureFields) values.updatedBy = locals.user?.id;
				if (transform) values = await transform(values, event);
				await db.update(table).set(values).where(eq(table.id, data.id));
				return message(form, { type: 'success', text: `${label} updated` });
			} catch (err) {
				console.error(`Failed to update ${label}:`, err);
				return message(form, { type: 'error', text: `Could not update ${label}` }, { status: 500 });
			}
		},

		/**
		 * Soft delete, super admin only.
		 *
		 * `isActive`/`status` are deliberately left alone. They are *business*
		 * state — `/contracts/inactive` and `/employees/inactive` exist to list
		 * rows where they are false — so writing them here would destroy the real
		 * status of the row if the deletion is ever reversed. `deletedAt` is the
		 * only marker a delete sets; see `$lib/server/softDelete`.
		 */
		delete: async ({ request, locals }: RequestEvent) => {
			requireSuperAdmin(locals);

			const form = await superValidate(request, zod4(idSchema));
			if (!form.valid) {
				return message(form, { type: 'error', text: 'Invalid request' }, { status: 400 });
			}

			try {
				const id = (form.data as FormData).id;
				if (isSoftDeletable) {
					await db
						.update(table)
						.set({ deletedAt: sql`NOW()`, deletedBy: locals.user?.id })
						.where(eq(table.id, id));
				} else {
					// No delete marker on this table, so there is nothing to soft
					// delete — the caller gets a hard delete or nothing at all.
					await db.delete(table).where(eq(table.id, id));
				}
				return message(form, { type: 'success', text: `${label} deleted` });
			} catch (err) {
				console.error(`Failed to delete ${label}:`, err);
				return message(form, { type: 'error', text: `Could not delete ${label}` }, { status: 500 });
			}
		}
	};

	return { load, actions };
}
