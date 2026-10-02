/**
 * Text messages to patients: the gateway accounts, the templates, sending, and the log.
 *
 * **Every send is logged, sent or not.** A message that failed is as much a fact as one that went —
 * "did we tell her?" has to have an answer either way — and the log's cost column is what a clinic
 * paying per segment reconciles its gateway bill against.
 *
 * **What is never sent:** a message to a patient who asked for none (`patient.smsOptOut`), to a
 * number that is not an Ethiopian mobile (`ethiopianMobile`), or with no gateway set up. Each comes
 * back as `skipped` with the reason, so the screen can say why rather than pretend.
 *
 * **The key is decrypted only for the send** (`server/secrets.ts`), inside this module, and is
 * never returned: `smsAccounts` gives the screen a hint of its last four characters and nothing
 * else.
 *
 * Non-goals: sending inside a database transaction (a gateway can take seconds, and a lock held
 * across a network call blocks the desk), retries (the desk presses again), and scheduled sending —
 * reminders go out when someone at the desk sends them, from the Reminders list.
 */
import { and, desc, eq, gte, inArray, max, ne } from 'drizzle-orm';

import type { RequestEvent } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import {
	appointment,
	appointmentType,
	branch,
	clinicSettings,
	patient,
	recall,
	smsMessage,
	smsProvider
} from '$lib/server/db/schema';
import type { SmsProviderName } from '$lib/smsTemplates';
import { notDeleted, softDeleteSmsProvider } from '$lib/server/softDelete';
import { branchFilter, type BranchContext } from '$lib/server/branchScope';
import { recordAudit, type AuditRequest } from '$lib/server/audit';
import { insertReturningId } from '@nahu/admin-kit/server/db/insert.js';
import { decryptSecret, encryptSecret, secretHint } from '$lib/server/secrets';
import { WriteRefused, refuseUnless } from '$lib/server/childCrud';
import { recordReminder } from '$lib/server/reminders';
import { messagesFor } from '$lib/i18n/messages';
import type { Lang } from '$lib/i18n/lang';
import { formatEthiopianDate } from '$lib/global.svelte';
import { patientFullName } from '$lib/server/patients';
import { ethiopianClock } from '$lib/clinicTime';
import {
	DEFAULT_SMS_TEMPLATES,
	ethiopianMobile,
	fillTemplate,
	smsSegments
} from '$lib/smsTemplates';
import { sendThrough } from './gateways';

/** The database or a transaction on it. */
type Reader = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A gateway, as `SMS_PROVIDERS` names them. */
export type SmsGateway = SmsProviderName;

/** Why a message was sent, as the log records it. */
export type SmsKind = 'reminder' | 'recall' | 'test';

/** What became of one message. */
/**
 * What became of one message. A skip carries a code, not a sentence, so each screen says it in
 * the viewer's language; a failure carries the gateway's own words, which no dictionary can hold.
 */
export type SmsOutcome =
	| { status: 'sent'; segments: number; cost: number | null }
	| { status: 'failed'; reason: string }
	| { status: 'skipped'; why: SmsSkip };

/** Why a message was not sent at all. */
export type SmsSkip = 'optedOut' | 'noMobile' | 'noGateway';

/* ── Accounts ────────────────────────────────────────────────────────────────────────────────── */

/** The gateway accounts, for the screen — everything but the key, which only its hint stands for. */
export async function smsAccounts(reader: Reader = db) {
	return reader
		.select({
			id: smsProvider.id,
			provider: smsProvider.provider,
			label: smsProvider.label,
			apiKeyHint: smsProvider.apiKeyHint,
			senderName: smsProvider.senderName,
			senderId: smsProvider.senderId,
			costPerSegment: smsProvider.costPerSegment,
			isDefault: smsProvider.isDefault
		})
		.from(smsProvider)
		.where(notDeleted(smsProvider))
		.orderBy(desc(smsProvider.isDefault), smsProvider.label);
}

/** What a save posts. An empty `apiKey` on an edit keeps the stored key. */
export type AccountInput = {
	id?: number;
	provider: SmsGateway;
	label: string;
	apiKey?: string;
	senderName?: string | null;
	senderId?: string | null;
	costPerSegment?: number | null;
	isDefault: boolean;
};

/**
 * Adds or changes a gateway account, in the caller's transaction, audited. A new account needs a
 * key; an edit keeps the stored one unless a new one is typed. Making it the default takes the
 * mark off every other, so there is never more than one to send through. The first account is the
 * default whatever was ticked: an account that cannot be sent through is a puzzle, not a setting.
 */
export async function saveAccount(
	tx: Tx,
	event: AuditRequest,
	input: AccountInput
): Promise<number> {
	const userId = event.locals.user?.id;
	const key = input.apiKey?.trim() ?? '';
	const fields = {
		provider: input.provider,
		label: input.label.trim(),
		senderName: input.senderName?.trim() || null,
		senderId: input.senderId?.trim() || null,
		costPerSegment: input.costPerSegment ?? null,
		...(key ? { apiKeyEncrypted: encryptSecret(key), apiKeyHint: secretHint(key) } : {}),
		updatedBy: userId
	};

	const others = await tx
		.select({ id: smsProvider.id })
		.from(smsProvider)
		.where(and(notDeleted(smsProvider), input.id ? ne(smsProvider.id, input.id) : undefined));
	const isDefault = input.isDefault || others.length === 0;

	let id: number;
	if (input.id) {
		const [before] = await tx
			.select()
			.from(smsProvider)
			.where(and(eq(smsProvider.id, input.id), notDeleted(smsProvider)))
			.limit(1);
		refuseUnless(Boolean(before), 'That account no longer exists.');
		const after = { ...fields, isDefault };
		await tx.update(smsProvider).set(after).where(eq(smsProvider.id, before.id));
		await recordAudit(tx, event, {
			table: 'sms_provider',
			recordId: before.id,
			action: 'update',
			before,
			after
		});
		id = before.id;
	} else {
		refuseUnless(Boolean(key), 'Enter the API key the gateway gave you.', 'apiKey');
		id = await insertReturningId(tx, smsProvider, {
			...fields,
			apiKeyEncrypted: encryptSecret(key),
			apiKeyHint: secretHint(key),
			isDefault,
			createdBy: userId
		});
		await recordAudit(tx, event, { table: 'sms_provider', recordId: id, action: 'create' });
	}

	if (isDefault) {
		await tx
			.update(smsProvider)
			.set({ isDefault: false, updatedBy: userId })
			.where(and(ne(smsProvider.id, id), eq(smsProvider.isDefault, true)));
	}
	return id;
}

/** Removes an account, audited. If it was the default, the next one left becomes the default. */
export async function removeAccount(tx: Tx, event: AuditRequest, id: number): Promise<void> {
	const userId = event.locals.user?.id;
	const [row] = await tx
		.select({ id: smsProvider.id, isDefault: smsProvider.isDefault })
		.from(smsProvider)
		.where(and(eq(smsProvider.id, id), notDeleted(smsProvider)))
		.limit(1);
	refuseUnless(Boolean(row), 'That account no longer exists.');
	await softDeleteSmsProvider(tx, id, userId);
	await recordAudit(tx, event, { table: 'sms_provider', recordId: id, action: 'delete' });
	if (row.isDefault) {
		const [next] = await tx
			.select({ id: smsProvider.id })
			.from(smsProvider)
			.where(notDeleted(smsProvider))
			.orderBy(smsProvider.id)
			.limit(1);
		if (next)
			await tx
				.update(smsProvider)
				.set({ isDefault: true, updatedBy: userId })
				.where(eq(smsProvider.id, next.id));
	}
}

/* ── Templates ───────────────────────────────────────────────────────────────────────────────── */

/** The clinic's two templates, or the defaults where the settings row is missing. */
export async function smsTemplates(
	reader: Reader = db
): Promise<{ reminder: string; recall: string }> {
	const [row] = await reader
		.select({
			reminder: clinicSettings.smsReminderTemplate,
			recall: clinicSettings.smsRecallTemplate
		})
		.from(clinicSettings)
		.where(eq(clinicSettings.id, 1))
		.limit(1);
	return row ?? { ...DEFAULT_SMS_TEMPLATES };
}

/** Saves the two templates. Configuration, so `updatedBy` on the row rather than an audit row. */
export async function saveTemplates(
	tx: Tx,
	userId: string | undefined,
	templates: { reminder: string; recall: string }
): Promise<void> {
	await tx
		.update(clinicSettings)
		.set({
			smsReminderTemplate: templates.reminder.trim(),
			smsRecallTemplate: templates.recall.trim(),
			updatedBy: userId ?? null
		})
		.where(eq(clinicSettings.id, 1));
}

/* ── Building the messages ───────────────────────────────────────────────────────────────────── */

/** Who a message about a patient goes to, and whether it may go. */
type Recipient = { patientId: number; name: string; phone: string | null; optedOut: boolean };

/** The reminder for one appointment at the working branch: the text, and who it goes to. */
export async function reminderFor(appointmentId: number, branchCtx: Pick<BranchContext, 'active'>) {
	const [row] = await db
		.select({
			patientId: patient.id,
			name: patient.name,
			phone: patient.phone,
			optedOut: patient.smsOptOut,
			startsAt: appointment.startsAt,
			branchId: appointment.branchId,
			clinic: branch.name,
			clinicPhone: branch.phone
		})
		.from(appointment)
		.innerJoin(patient, eq(patient.id, appointment.patientId))
		.leftJoin(branch, eq(branch.id, appointment.branchId))
		.where(
			and(
				eq(appointment.id, appointmentId),
				notDeleted(appointment),
				branchFilter(appointment.branchId, branchCtx)
			)
		)
		.limit(1);
	if (!row) return null;
	const { reminder } = await smsTemplates();
	const recipient: Recipient = {
		patientId: row.patientId,
		name: row.name,
		phone: row.phone,
		optedOut: row.optedOut
	};
	return {
		recipient,
		branchId: row.branchId,
		body: fillTemplate(reminder, {
			name: row.name,
			date: formatEthiopianDate(new Date(row.startsAt)),
			time: ethiopianClock(row.startsAt),
			clinic: row.clinic,
			phone: row.clinicPhone
		})
	};
}

/** The recall message for one due recall at the working branch. */
export async function recallMessageFor(recallId: number, branchCtx: Pick<BranchContext, 'active'>) {
	const [row] = await db
		.select({
			patientId: patient.id,
			name: patient.name,
			phone: patient.phone,
			optedOut: patient.smsOptOut,
			visit: appointmentType.name,
			branchId: recall.branchId,
			clinic: branch.name,
			clinicPhone: branch.phone
		})
		.from(recall)
		.innerJoin(patient, eq(patient.id, recall.patientId))
		.leftJoin(appointmentType, eq(appointmentType.id, recall.appointmentTypeId))
		.leftJoin(branch, eq(branch.id, recall.branchId))
		.where(
			and(eq(recall.id, recallId), notDeleted(recall), branchFilter(recall.branchId, branchCtx))
		)
		.limit(1);
	if (!row) return null;
	const { recall: template } = await smsTemplates();
	const recipient: Recipient = {
		patientId: row.patientId,
		name: row.name,
		phone: row.phone,
		optedOut: row.optedOut
	};
	return {
		recipient,
		branchId: row.branchId,
		body: fillTemplate(template, {
			name: row.name,
			visit: row.visit,
			clinic: row.clinic,
			phone: row.clinicPhone
		})
	};
}

/* ── Sending ─────────────────────────────────────────────────────────────────────────────────── */

/** The account messages go through, key and all — never handed to anything outside this module. */
async function defaultAccount(reader: Reader) {
	const [row] = await reader
		.select()
		.from(smsProvider)
		.where(
			and(eq(smsProvider.isDefault, true), eq(smsProvider.isActive, true), notDeleted(smsProvider))
		)
		.limit(1);
	return row ?? null;
}

/** One account, key and all, for a send through it in particular. */
async function accountById(reader: Reader, id: number) {
	const [row] = await reader
		.select()
		.from(smsProvider)
		.where(and(eq(smsProvider.id, id), notDeleted(smsProvider)))
		.limit(1);
	return row ?? null;
}

/**
 * Sends one message and logs it. Never throws for a gateway's sake: the outcome says what happened.
 * `accountId` sends through a particular account (the screen's test send). `fetcher` and `reader`
 * are for tests: a fake gateway, and a rollback to log into.
 */
export async function sendSms(
	event: { locals: { user?: { id: string } | null; branch: { active: number | null } } },
	message: {
		kind: SmsKind;
		body: string;
		phone: string | null;
		patientId?: number | null;
		appointmentId?: number | null;
		recallId?: number | null;
		branchId?: number | null;
		optedOut?: boolean;
		accountId?: number;
	},
	{ fetcher = fetch, reader = db }: { fetcher?: typeof fetch; reader?: Reader } = {}
): Promise<SmsOutcome> {
	if (message.optedOut) return { status: 'skipped', why: 'optedOut' };
	const to = ethiopianMobile(message.phone);
	if (!to) return { status: 'skipped', why: 'noMobile' };

	const account = message.accountId
		? await accountById(reader, message.accountId)
		: await defaultAccount(reader);
	if (!account)
		return {
			status: 'skipped',
			why: 'noGateway'
		};

	let apiKey: string;
	try {
		apiKey = decryptSecret(account.apiKeyEncrypted);
	} catch (err: unknown) {
		return {
			status: 'failed',
			reason: err instanceof Error ? err.message : 'The stored key could not be read.'
		};
	}

	const result = await sendThrough(
		account.provider,
		{
			apiKey,
			to,
			message: message.body,
			senderName: account.senderName,
			senderId: account.senderId
		},
		fetcher
	);
	const { segments } = smsSegments(message.body);
	const cost =
		result.ok && account.costPerSegment !== null
			? Math.round(segments * account.costPerSegment * 100) / 100
			: null;

	await reader.insert(smsMessage).values({
		patientId: message.patientId ?? null,
		appointmentId: message.appointmentId ?? null,
		recallId: message.recallId ?? null,
		kind: message.kind,
		toPhone: to,
		body: message.body,
		providerId: account.id,
		provider: account.provider,
		status: result.ok ? 'sent' : 'failed',
		providerMessageId: result.ok ? result.messageId : null,
		error: result.ok ? null : result.error.slice(0, 255),
		segments,
		cost,
		branchId: message.branchId ?? event.locals.branch.active ?? undefined,
		createdBy: event.locals.user?.id
	});

	return result.ok
		? { status: 'sent', segments, cost }
		: { status: 'failed', reason: result.error };
}

/* ── The log ─────────────────────────────────────────────────────────────────────────────────── */

/** Messages at the working branch since `since`, newest first, with who they went to. */
export async function smsLog(branchCtx: Pick<BranchContext, 'active'>, since: Date) {
	return db
		.select({
			id: smsMessage.id,
			sentAt: smsMessage.createdAt,
			kind: smsMessage.kind,
			toPhone: smsMessage.toPhone,
			body: smsMessage.body,
			provider: smsMessage.provider,
			status: smsMessage.status,
			error: smsMessage.error,
			segments: smsMessage.segments,
			cost: smsMessage.cost,
			patientId: smsMessage.patientId,
			patient: patientFullName
		})
		.from(smsMessage)
		.leftJoin(patient, eq(patient.id, smsMessage.patientId))
		.where(
			and(
				gte(smsMessage.createdAt, since),
				notDeleted(smsMessage),
				branchFilter(smsMessage.branchId, branchCtx)
			)
		)
		.orderBy(desc(smsMessage.createdAt))
		.limit(500);
}

/** The appointments among `ids` that a reminder text went to, and when it last did. */
export async function textedAppointments(ids: number[]): Promise<Map<number, Date>> {
	if (ids.length === 0) return new Map();
	const rows = await db
		.select({ appointmentId: smsMessage.appointmentId, at: max(smsMessage.createdAt) })
		.from(smsMessage)
		.where(
			and(
				inArray(smsMessage.appointmentId, ids),
				eq(smsMessage.status, 'sent'),
				eq(smsMessage.kind, 'reminder'),
				notDeleted(smsMessage)
			)
		)
		.groupBy(smsMessage.appointmentId);
	return new Map(
		rows.flatMap((r) =>
			r.appointmentId === null || r.at === null ? [] : [[r.appointmentId, r.at]]
		)
	);
}

/** The recalls among `ids` that a text went to, and when it last did. */
export async function textedRecalls(ids: number[]): Promise<Map<number, Date>> {
	if (ids.length === 0) return new Map();
	const rows = await db
		.select({ recallId: smsMessage.recallId, at: max(smsMessage.createdAt) })
		.from(smsMessage)
		.where(
			and(
				inArray(smsMessage.recallId, ids),
				eq(smsMessage.status, 'sent'),
				eq(smsMessage.kind, 'recall'),
				notDeleted(smsMessage)
			)
		)
		.groupBy(smsMessage.recallId);
	return new Map(
		rows.flatMap((r) => (r.recallId === null || r.at === null ? [] : [[r.recallId, r.at]]))
	);
}

/** Whether there is a gateway to send through, so a list can offer the button at all. */
export async function smsReady(reader: Reader = db): Promise<boolean> {
	return (await defaultAccount(reader)) !== null;
}

/** An outcome as the toast says it, in the viewer's language. */
export function describeOutcome(
	outcome: SmsOutcome,
	lang: Lang
): { type: 'success' | 'error'; text: string } {
	const words = messagesFor(lang).common.sms;
	if (outcome.status === 'sent') return { type: 'success', text: words.sent };
	if (outcome.status === 'failed') return { type: 'error', text: words.failed(outcome.reason) };
	return { type: 'error', text: words.skipped[outcome.why] };
}

/**
 * Texts the reminder for one appointment at the working branch. A text that goes out is a reminder
 * given, so it stamps `reminderSentAt` as a call does — the list then shows the patient as
 * reminded, and the no-show comparison counts it. Null when the appointment is not here.
 */
export async function textReminder(
	event: Pick<RequestEvent, 'locals' | 'getClientAddress'>,
	appointmentId: number
): Promise<SmsOutcome | null> {
	const built = await reminderFor(appointmentId, event.locals.branch);
	if (!built) return null;
	const outcome = await sendSms(event, {
		kind: 'reminder',
		body: built.body,
		phone: built.recipient.phone,
		optedOut: built.recipient.optedOut,
		patientId: built.recipient.patientId,
		appointmentId,
		branchId: built.branchId
	});
	if (outcome.status === 'sent') {
		try {
			await db.transaction((tx) =>
				recordReminder(tx, event, appointmentId, { confirmed: false, lang: event.locals.lang })
			);
		} catch (err: unknown) {
			// The text went; only the stamp failed (the visit changed meanwhile). The log has it.
			if (!(err instanceof WriteRefused)) throw err;
		}
	}
	return outcome;
}

/** Texts the recall message for one due recall at the working branch. Null when it is not here. */
export async function textRecall(
	event: Pick<RequestEvent, 'locals'>,
	recallId: number
): Promise<SmsOutcome | null> {
	const built = await recallMessageFor(recallId, event.locals.branch);
	if (!built) return null;
	return sendSms(event, {
		kind: 'recall',
		body: built.body,
		phone: built.recipient.phone,
		optedOut: built.recipient.optedOut,
		patientId: built.recipient.patientId,
		recallId,
		branchId: built.branchId
	});
}
