import { fail, type RequestEvent } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';
import type { AnyMySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core';
import { db } from '$lib/server/db';
import { requireSuperAdmin } from '$lib/server/permissions';
import { softDeleteLookup, type SoftDeletable } from '$lib/server/softDelete';

type LookupTable = MySqlTable & SoftDeletable & { id: AnyMySqlColumn };

/**
 * Builds the `delete` action for an admin-panel lookup page.
 *
 * Every one of those pages is the same shape — one table of reference rows with
 * add and edit actions — so they share one action instead of twenty copies that
 * would drift apart. `table` is bound per page, never read from the request:
 * the client picks which button to press, never which table gets written to.
 *
 * `label` is what the user sees in the flash message, e.g. "department".
 */
export function lookupDeleteAction(table: LookupTable, label: string) {
	return async ({ request, locals, cookies }: RequestEvent) => {
		requireSuperAdmin(locals);

		const data = await request.formData();
		const rowId = Number(data.get('id'));

		if (!rowId) {
			setFlash({ type: 'error', message: `No ${label} was selected.` }, cookies);
			return fail(400);
		}

		try {
			const deleted = await db.transaction(async (tx) =>
				softDeleteLookup(tx, table, rowId, locals.user?.id)
			);

			if (!deleted) {
				setFlash({ type: 'error', message: `That ${label} was not found.` }, cookies);
				return fail(404);
			}
		} catch (err) {
			console.error(`Error deleting ${label}:`, err);
			setFlash(
				{
					type: 'error',
					message: `Could not delete ${label}: ${err instanceof Error ? err.message : 'Unknown error'}`
				},
				cookies
			);
			return fail(500);
		}

		setFlash({ type: 'success', message: `${label} deleted.` }, cookies);
		return { success: true };
	};
}
