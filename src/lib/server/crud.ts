import { superValidate, message, setError } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { and, asc, eq, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { z } from 'zod/v4';
import type { RequestEvent } from '@sveltejs/kit';
import type { MySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
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

/**
 * A row on its way into `insert().values()` or `update().set()`.
 *
 * `contentCrud` is generic over the table so `rows` comes back typed for the caller, but the
 * *write* side is assembled at runtime from form data, `transform` and the reference remapping —
 * there is no static type that describes it. Named here rather than cast inline four times, per
 * CLAUDE.md §3: an unavoidable `any` gets a name and a reason.
 */
type WritableRow = Record<string, unknown>;

/**
 * The list query while it is being assembled.
 *
 * `$dynamic()` is what allows joins and filters to be added in a loop — without it every
 * `leftJoin` returns a differently-shaped builder that cannot be reassigned. Its real type is
 * parameterised by a projection built at runtime from `references`, so there is no static shape
 * to name. Rather than reach for `any`, this names the three methods actually called; the row
 * type is restored on the way out with `T['$inferSelect']`.
 */
type DynamicListQuery = PromiseLike<Record<string, unknown>[]> & {
	leftJoin(table: AnyTable, on: SQL | undefined): DynamicListQuery;
	where(condition: SQL | undefined): DynamicListQuery;
	orderBy(column: SQL | AnyColumn): DynamicListQuery;
};

/**
 * A foreign key a lookup screen shows by name and edits through a picker.
 *
 * Deliberately does not model a form key that differs from its column: `services` was the only
 * table that did that, and normalising it was cheaper than carrying the indirection forever.
 *
 * Also not an attribution join. `payment-methods` shows who created a row, which needs the id
 * *and* the name, and must not filter deleted users (CLAUDE.md §9) — different problem, own page.
 */
export interface CrudReference {
	/** The foreign-key column, which is also the form key and the `LookupConfig` field name. */
	field: string;
	/** The referenced table, joined so the list can show a name. */
	table: AnyTable;
	/** Key on each returned row carrying the referenced name — `'region'`. */
	as: string;
	/** Loads the picker's options. A `fastData` helper, normally. */
	options: () => Promise<{ value: number; name: string }[]>;
	/** Key in the returned load data for those options — `'regionList'`. */
	optionsKey: string;
}

/** MySQL's unique-constraint violation. */
function isDuplicateKey(err: unknown): boolean {
	return (err as { code?: string })?.code === 'ER_DUP_ENTRY';
}

interface CrudOptions<T extends AnyTable> {
	/** The Drizzle table being managed. */
	table: T;
	/** Singular, human-readable name used in toast messages, e.g. "Farm". */
	label: string;
	addSchema: AnySchema;
	editSchema: AnySchema;
	/** Fields holding an uploaded File; saved to disk and stored as a filename. */
	fileFields?: string[];
	/** Fields entered as one-per-line text and stored as a JSON string array. */
	listFields?: string[];
	/**
	 * Limit the list to rows whose `isActive`/`status` is true.
	 *
	 * Off by default, because the pages that list content tables are the ones that *set* that
	 * flag — an admin who cannot see the inactive rows cannot reactivate them. Turn it on for a
	 * picker or a public list.
	 */
	activeOnly?: boolean;
	/**
	 * The unique column a duplicate insert collides on, so `ER_DUP_ENTRY` can be reported against
	 * the field the user actually typed rather than as a generic failure. Defaults to `name`,
	 * which is the unique column on every lookup table here.
	 */
	uniqueField?: string;
	/**
	 * Foreign keys this table displays by name and edits through a picker.
	 *
	 * Each entry does three things the route would otherwise hand-write: joins the referenced
	 * table so the list shows `region` rather than `region_id`, loads the picker's options, and
	 * — where the form key and the column differ — maps one to the other on write.
	 *
	 * Pairs one-for-one with a `reference` field in the screen's `LookupConfig`.
	 */
	references?: CrudReference[];
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
export function contentCrud<T extends AnyTable>({
	table,
	label,
	addSchema,
	editSchema,
	fileFields = [],
	listFields = [],
	activeOnly = false,
	uniqueField = 'name',
	references = [],
	transform
}: CrudOptions<T>) {
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
		/*
		 * With no references this is `select()` over the table, exactly as before. With them it
		 * becomes an explicit projection — every column of the table, plus one name per reference
		 * — because Drizzle widens a joined `select()` into `{ table: {...}, region: {...} }`,
		 * and the list components expect one flat row.
		 */
		const projection = references.length
			? {
					...(table as Record<string, MySqlColumn>),
					...Object.fromEntries(references.map((ref) => [ref.as, ref.table.name]))
				}
			: undefined;

		// `$dynamic()` is what lets the joins and the `where` be added in a loop; without it each
		// `leftJoin` returns a differently-shaped builder that cannot be reassigned.
		// See `DynamicListQuery` for why the builder is narrowed to the three methods used here.
		let query = (projection ? db.select(projection) : db.select())
			.from(table)
			.$dynamic() as unknown as DynamicListQuery;

		for (const ref of references) {
			// `notDeleted` goes in the `on`, not the `where`: a deleted region must blank the name,
			// not drop the city. See CLAUDE.md §9.
			query = query.leftJoin(
				ref.table,
				and(eq(ref.table.id, table[ref.field]), notDeleted(ref.table as never))
			);
		}

		// Deleted rows are excluded independently of `isActive`/`status`: those are
		// business state, this is the delete marker.
		const conditions = [
			...(activeOnly && activeColumn ? [eq(activeColumn, true)] : []),
			...(isSoftDeletable ? [notDeleted(table as never)] : [])
		];

		if (conditions.length) query = query.where(and(...conditions));
		query = query.orderBy(asc(orderColumn));

		const [addForm, editForm, deleteForm, rows, ...optionLists] = await Promise.all([
			superValidate(zod4(addSchema)),
			superValidate(zod4(editSchema)),
			superValidate(zod4(idSchema)),
			// `AnyTable` erases the row shape for the generic helpers above, so it is restored here
			// from the table's own inferred select type. Without this every consumer of `rows`
			// sees `unknown` and has to cast.
			query as unknown as Promise<T['$inferSelect'][]>,
			...references.map((ref) => ref.options())
		]);

		return {
			addForm,
			editForm,
			deleteForm,
			rows,
			// Keyed as the screen's `reference` fields name them, e.g. `regionList`.
			...Object.fromEntries(references.map((ref, i) => [ref.optionsKey, optionLists[i]]))
		};
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
				await db.insert(table).values(values as T['$inferInsert']);
				return message(form, { type: 'success', text: `${label} added` });
			} catch (err) {
				if (isDuplicateKey(err)) {
					setError(form, uniqueField as never, `That ${label.toLowerCase()} already exists.`);
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
				await db
					.update(table)
					.set(values as Partial<T['$inferInsert']>)
					.where(eq(table.id, data.id));
				return message(form, { type: 'success', text: `${label} updated` });
			} catch (err) {
				if (isDuplicateKey(err)) {
					setError(form, uniqueField as never, `That ${label.toLowerCase()} already exists.`);
					return message(
						form,
						{ type: 'error', text: `That ${label.toLowerCase()} already exists.` },
						{ status: 400 }
					);
				}

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
						.set({ deletedAt: sql`NOW()`, deletedBy: locals.user?.id } as WritableRow)
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
