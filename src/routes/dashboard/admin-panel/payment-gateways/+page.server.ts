import { error, type RequestEvent } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { formAction } from '$lib/server/patientAction';
import { gatewayAccounts, removeGateway, saveGateway } from '$lib/server/onlinePayments';
import { recentOnlinePayments } from '$lib/server/onlinePayments/log';
import { GATEWAY_FIELD_KEYS } from '$lib/paymentGateways';
import { addClinicDays, clinicDayRange, clinicToday } from '$lib/clinicTime';
import { gateway, remove } from './schema';

/**
 * The payment gateways screen: the clinic's accounts at Chapa, Telebirr, ArifPay and SantimPay, the
 * address each gateway posts its notifications to, and every online payment of the last thirty days.
 *
 * Reading it needs the admin panel's `settings.manage`. **Adding, changing or removing an account
 * needs a super admin** in the action itself — a gateway key takes the clinic's money in, the same
 * standing as a delete (CLAUDE.md §9). The keys never come back to this page, only a hint.
 */
const PERMISSION = 'settings.manage';
const LOG_DAYS = 30;

export const load = async ({ locals, url }: RequestEvent) => {
	const since = clinicDayRange(addClinicDays(clinicToday(), -LOG_DAYS)).start;
	const [accounts, log, addForm, editForm, removeForm] = await Promise.all([
		gatewayAccounts(),
		recentOnlinePayments(locals.branch, since),
		superValidate(zod4(gateway), { id: 'gateway-add' }),
		superValidate(zod4(gateway), { id: 'gateway-edit' }),
		superValidate(zod4(remove), { id: 'gateway-remove' })
	]);
	return {
		accounts,
		log,
		logDays: LOG_DAYS,
		// Where each gateway is told to post its notifications. A clinic on a local install has no
		// address the internet can reach; the desk's Check button covers that.
		notifyBase: `${url.origin}/api/payments`,
		canManageKeys: locals.isSuperAdmin,
		forms: { add: addForm, edit: editForm, remove: removeForm }
	};
};

/** Refuses anyone but a super admin, with a reason that fits a key rather than a delete. */
function keysNeedSuperAdmin(event: RequestEvent) {
	if (!event.locals.isSuperAdmin) {
		error(403, 'Only a super administrator can add, change or remove a payment gateway key.');
	}
}

export const actions = {
	save: async (event: RequestEvent) => {
		keysNeedSuperAdmin(event);
		return formAction(event, PERMISSION, gateway, async (data) => async (tx) => {
			await saveGateway(tx, event, {
				id: data.id,
				provider: data.provider,
				label: data.label,
				mode: data.mode,
				enabled: data.enabled,
				fields: Object.fromEntries(GATEWAY_FIELD_KEYS.map((key) => [key, data[key]]))
			});
			return data.id ? 'Account saved' : 'Account added';
		});
	},

	remove: async (event: RequestEvent) => {
		keysNeedSuperAdmin(event);
		return formAction(event, PERMISSION, remove, async (data) => async (tx) => {
			await removeGateway(tx, event, data.id);
			return 'Account removed';
		});
	}
};
