import { error, type RequestEvent } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import { formAction } from '$lib/server/patientAction';
import { requirePermission } from '$lib/server/permissions';
import {
	removeAccount,
	saveAccount,
	saveTemplates,
	sendSms,
	smsAccounts,
	smsLog,
	smsTemplates
} from '$lib/server/sms';
import { GATEWAY_NAMES } from '$lib/server/sms/gateways';
import { addClinicDays, clinicDayRange, clinicToday } from '$lib/clinicTime';
import { account, remove, templates, testSend } from './schema';

/**
 * The SMS screen: which gateway the clinic sends through, what reminders and recalls say, and every
 * message sent in the last thirty days with what it cost.
 *
 * Reading it, editing the templates and sending a test need the screen's own `settings.manage`.
 * **Adding, changing or removing a gateway account needs a super admin** in the action itself: an
 * API key is a credential that spends the clinic's money, the same standing as a delete (CLAUDE.md
 * §9). The key never comes back to this page — only its last four characters.
 */
const PERMISSION = 'settings.manage';
const LOG_DAYS = 30;

export const load = async ({ locals }: RequestEvent) => {
	const since = clinicDayRange(addClinicDays(clinicToday(), -LOG_DAYS)).start;
	// The add and edit dialogs each get their own form id, so a save's reply reaches only the
	// dialog that sent it.
	const [accounts, current, log, accountForm, editForm, templateForm, testForm, removeForm] =
		await Promise.all([
			smsAccounts(),
			smsTemplates(),
			smsLog(locals.branch, since),
			superValidate(zod4(account), { id: 'sms-account' }),
			superValidate(zod4(account), { id: 'sms-account-edit' }),
			superValidate(zod4(templates), { id: 'sms-templates' }),
			superValidate(zod4(testSend), { id: 'sms-test' }),
			superValidate(zod4(remove), { id: 'sms-remove' })
		]);
	templateForm.data = current;
	return {
		accounts,
		gatewayNames: GATEWAY_NAMES,
		log,
		logDays: LOG_DAYS,
		canManageKeys: locals.isSuperAdmin,
		forms: {
			account: accountForm,
			accountEdit: editForm,
			templates: templateForm,
			test: testForm,
			remove: removeForm
		}
	};
};

/** Refuses anyone but a super admin, with a reason that fits a key rather than a delete. */
function keysNeedSuperAdmin(event: RequestEvent) {
	if (!event.locals.isSuperAdmin) {
		error(403, 'Only a super administrator can add, change or remove an SMS gateway key.');
	}
}

export const actions = {
	saveAccount: async (event: RequestEvent) => {
		keysNeedSuperAdmin(event);
		return formAction(event, PERMISSION, account, async (data) => async (tx) => {
			await saveAccount(tx, event, data);
			return data.id ? 'Account saved' : 'Account added';
		});
	},

	removeAccount: async (event: RequestEvent) => {
		keysNeedSuperAdmin(event);
		return formAction(event, PERMISSION, remove, async (data) => async (tx) => {
			await removeAccount(tx, event, data.id);
			return 'Account removed';
		});
	},

	saveTemplates: (event: RequestEvent) =>
		formAction(event, PERMISSION, templates, async (data) => async (tx) => {
			await saveTemplates(tx, event.locals.user?.id, data);
			return 'Messages saved';
		}),

	/**
	 * A test message through one account. Not in a transaction: a gateway can take seconds, and
	 * nothing here needs to roll back — the send is logged as a `test` either way.
	 */
	sendTest: async (event: RequestEvent) => {
		// Spends money at the gateway, so checked here as well as by the route's gate.
		requirePermission(event.locals, PERMISSION);
		const form = await superValidate(event.request, zod4(testSend), { id: 'sms-test' });
		if (!form.valid)
			return message(form, { type: 'error', text: 'Check the form.' }, { status: 400 });
		const outcome = await sendSms(event, {
			kind: 'test',
			body: 'Test message from the clinic system. Your SMS gateway works.',
			phone: form.data.phone,
			accountId: form.data.accountId
		});
		if (outcome.status === 'sent') {
			return message(form, { type: 'success', text: 'Test message sent. Check the phone.' });
		}
		const text =
			outcome.status === 'failed'
				? outcome.reason
				: {
						optedOut: 'That number belongs to a patient who asked not to be texted.',
						noMobile: 'That is not an Ethiopian mobile number (09… or 07…).',
						noGateway: 'That account no longer exists.'
					}[outcome.why];
		return message(form, { type: 'error', text }, { status: 400 });
	}
};
