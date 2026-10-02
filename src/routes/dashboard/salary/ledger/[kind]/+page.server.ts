import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { formAction } from '$lib/server/patientAction';
import { requireSuperAdmin } from '$lib/server/permissions';
import { overtimeTypes } from '$lib/server/fastData';
import { currentQuery, pagination, parseTableQuery } from '$lib/server/queryFilters';
import {
	LEDGER_FILTERS,
	LEDGER_SORTS,
	ledgerPage,
	payableEmployees
} from '$lib/server/payrollLedger';
import {
	recordAdjustments,
	removeAdjustment,
	updateAdjustment,
	type LedgerInput
} from '$lib/server/payrollLedgerWrites';
import { LEDGER, isLedgerKind, type LedgerKind } from '$lib/payrollLedger';
import { ledgerEdit, ledgerEntry, ledgerRemove, type LedgerEntry } from '$lib/forms/payrollLedger';
import type { Actions, PageServerLoad } from './$types';

/**
 * One pay-adjustment ledger — overtime, bonuses or deductions — over any period. The kind is the
 * path; everything the three share is `server/payrollLedger.ts` (reads) and
 * `payrollLedgerWrites.ts` (the rules). Gated by `salary.manage` (`routeRules`), which each action
 * checks again; removing an entry is a super admin's, as every delete is (CLAUDE.md §9).
 */

/** Who may record and change pay adjustments: whoever runs payroll. */
const PERMISSION = 'salary.manage';

function kindOf(raw: string | undefined): LedgerKind {
	if (!isLedgerKind(raw)) error(404, 'There is no such list.');
	return raw;
}

/** The form's strings, narrowed to what the writes take: '' and absent read as none. */
function input(data: Omit<LedgerEntry, 'staffIds'>): LedgerInput {
	return {
		date: data.date,
		typeId: Number(data.typeId) || null,
		type: data.type?.trim() || null,
		hours: data.hours || null,
		amount: data.amount || null,
		reason: data.reason?.trim() || null
	};
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const kind = kindOf(params.kind);
	const query = parseTableQuery(url, LEDGER_FILTERS, 25, LEDGER_SORTS);

	const [page, employees, types, add, edit, remove] = await Promise.all([
		ledgerPage(kind, query, locals.branch),
		payableEmployees(locals.branch),
		kind === 'overtime' ? overtimeTypes() : Promise.resolve([]),
		superValidate(zod4(ledgerEntry)),
		superValidate(zod4(ledgerEdit)),
		superValidate(zod4(ledgerRemove))
	]);

	return {
		kind,
		meta: LEDGER[kind],
		...page,
		employees: employees.map((e) => ({
			value: e.value,
			name: e.department ? `${e.name} · ${e.department}` : e.name
		})),
		types: types.map((t) => ({
			value: String(t.value),
			name: `${t.name} · ×${Number(t.rate)}${t.maxhours ? ` · up to ${t.maxhours} h` : ''}`
		})),
		forms: { add, edit, remove },
		canDelete: locals.isSuperAdmin === true,
		pagination: pagination(query, page.totals.entries),
		currentQuery: currentQuery(query)
	};
};

export const actions: Actions = {
	add: (event) =>
		formAction(event, PERMISSION, ledgerEntry, async (data) => {
			const kind = kindOf(event.params.kind);
			return async (tx) => {
				const made = await recordAdjustments(tx, event, kind, data.staffIds, input(data));
				return `${LEDGER[kind].title}: recorded for ${made} ${made === 1 ? 'employee' : 'employees'}.`;
			};
		}),

	edit: (event) =>
		formAction(event, PERMISSION, ledgerEdit, async (data) => {
			const kind = kindOf(event.params.kind);
			return async (tx) => {
				await updateAdjustment(tx, event, kind, data.id, input(data));
				return 'Saved.';
			};
		}),

	remove: (event) => {
		requireSuperAdmin(event.locals);
		return formAction(event, PERMISSION, ledgerRemove, async (data) => {
			const kind = kindOf(event.params.kind);
			return async (tx) => {
				await removeAdjustment(tx, event, kind, data.id);
				return 'Removed. It stays on the audit trail.';
			};
		});
	}
};
