import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { auditLog, smsMessage, smsProvider } from '../db/schema';
import { inRollback } from '$lib/testing/rollback';
import { decryptSecret } from '../secrets';
import { sendThrough } from './gateways';
import { removeAccount, saveAccount, sendSms, smsAccounts } from './index';

const KEY = 'sk_test_SECRETKEY_9876';
const event = {
	locals: { user: null, branch: { active: null } },
	getClientAddress: () => '127.0.0.1'
};

/** A fake gateway: records the request, answers with `reply`. */
function fakeFetch(reply: unknown, status = 200) {
	const calls: { url: string; init: RequestInit | undefined }[] = [];
	const fetcher: typeof fetch = async (input, init) => {
		calls.push({ url: String(input), init });
		return new Response(JSON.stringify(reply), { status });
	};
	return { fetcher, calls };
}

const request = {
	apiKey: KEY,
	to: '251911234567',
	message: 'ሰላም',
	senderName: 'Clinic',
	senderId: 'abc'
};

describe('gateways', () => {
	it('sends AfroMessage the key as a bearer token and the message in the query', async () => {
		const { fetcher, calls } = fakeFetch({
			acknowledge: 'success',
			response: { message_id: 'm-1' }
		});
		expect(await sendThrough('afromessage', request, fetcher)).toEqual({
			ok: true,
			messageId: 'm-1'
		});
		const url = new URL(calls[0].url);
		expect(url.origin + url.pathname).toBe('https://api.afromessage.com/api/send');
		expect(url.searchParams.get('to')).toBe('251911234567');
		expect(url.searchParams.get('message')).toBe('ሰላም');
		expect(url.searchParams.get('from')).toBe('abc');
		expect(url.searchParams.get('sender')).toBe('Clinic');
		expect(new Headers(calls[0].init?.headers).get('Authorization')).toBe(`Bearer ${KEY}`);
	});

	it('posts GeezSMS a JSON body with the token, phone and msg', async () => {
		const { fetcher, calls } = fakeFetch({ error: false, data: { message_id: 7 } });
		expect(await sendThrough('geezsms', request, fetcher)).toEqual({ ok: true, messageId: '7' });
		expect(calls[0].url).toBe('https://api.geezsms.com/api/v1/sms/send');
		expect(JSON.parse(String(calls[0].init?.body))).toEqual({
			token: KEY,
			phone: '251911234567',
			msg: 'ሰላም',
			shortcode_id: 'abc'
		});
	});

	it('reports a refusal in the gateway’s words, never with the key', async () => {
		const { fetcher } = fakeFetch({
			acknowledge: 'error',
			response: { errors: ['Insufficient balance'] }
		});
		const result = await sendThrough('afromessage', request, fetcher);
		expect(result).toEqual({ ok: false, error: 'Insufficient balance' });
		const bad = await sendThrough('geezsms', request, fakeFetch({}, 401).fetcher);
		expect(bad.ok).toBe(false);
		expect(JSON.stringify(bad)).not.toContain(KEY);
	});

	it('turns a network failure into a reason instead of throwing', async () => {
		const broken: typeof fetch = async () => {
			throw new TypeError('fetch failed');
		};
		expect(await sendThrough('afromessage', request, broken)).toEqual({
			ok: false,
			error: 'The gateway could not be reached. Check the internet connection.'
		});
	});

	it('refuses a message GeezSMS would reject for length before calling it', async () => {
		const { fetcher, calls } = fakeFetch({});
		const long = await sendThrough('geezsms', { ...request, message: 'a'.repeat(336) }, fetcher);
		expect(long.ok).toBe(false);
		expect(calls).toHaveLength(0);
	});
});

describe('accounts and sending', () => {
	it('stores the key encrypted, shows only its hint, and keeps one default', async () => {
		const result = await inRollback(async (tx) => {
			await tx.update(smsProvider).set({ deletedAt: new Date() });
			const first = await saveAccount(tx, event, {
				provider: 'afromessage',
				label: 'Main',
				apiKey: KEY,
				isDefault: false
			});
			const second = await saveAccount(tx, event, {
				provider: 'geezsms',
				label: 'Backup',
				apiKey: 'other-key-1111',
				isDefault: true
			});
			// An edit with no key typed keeps the stored one.
			await saveAccount(tx, event, {
				id: first,
				provider: 'afromessage',
				label: 'Main line',
				isDefault: false
			});
			const [stored] = await tx.select().from(smsProvider).where(eq(smsProvider.id, first));
			const accounts = await smsAccounts(tx);
			const audits = await tx.select().from(auditLog).where(eq(auditLog.tableName, 'sms_provider'));
			await removeAccount(tx, event, second);
			const afterRemoval = await smsAccounts(tx);
			return { stored, accounts, audits, afterRemoval, first };
		});

		expect(result.stored.apiKeyEncrypted).not.toContain('SECRETKEY');
		expect(decryptSecret(result.stored.apiKeyEncrypted)).toBe(KEY);
		expect(result.stored.label).toBe('Main line');
		expect(JSON.stringify(result.accounts)).not.toContain('SECRETKEY');
		expect(result.accounts.map((a) => a.apiKeyHint)).toContain('••••9876');
		// The first was the default until the second took it.
		expect(result.accounts.filter((a) => a.isDefault).map((a) => a.label)).toEqual(['Backup']);
		// Audited, and the key is nowhere in the audit rows.
		expect(result.audits.length).toBeGreaterThanOrEqual(3);
		expect(JSON.stringify(result.audits)).not.toContain('SECRETKEY');
		// Removing the default hands the mark to what is left.
		expect(result.afterRemoval).toEqual([
			expect.objectContaining({ id: result.first, isDefault: true })
		]);
	});

	it('sends through the default, logs it with its cost, and skips what must not be sent', async () => {
		const { fetcher, calls } = fakeFetch({ acknowledge: 'success', response: { message_id: 'x' } });
		const result = await inRollback(async (tx) => {
			await tx.update(smsProvider).set({ deletedAt: new Date() });
			const outcomes = {
				noGateway: await sendSms(
					event,
					{ kind: 'test', body: 'hi', phone: '0911234567' },
					{ fetcher, reader: tx }
				)
			};
			await saveAccount(tx, event, {
				provider: 'afromessage',
				label: 'Main',
				apiKey: KEY,
				costPerSegment: 0.35,
				isDefault: true
			});
			const sent = await sendSms(
				event,
				{ kind: 'test', body: 'ሰላም ለእናንተ', phone: '0911 23 45 67' },
				{ fetcher, reader: tx }
			);
			const optedOut = await sendSms(
				event,
				{ kind: 'test', body: 'hi', phone: '0911234567', optedOut: true },
				{ fetcher, reader: tx }
			);
			const landline = await sendSms(
				event,
				{ kind: 'test', body: 'hi', phone: '0111234567' },
				{ fetcher, reader: tx }
			);
			const log = await tx.select().from(smsMessage);
			return { ...outcomes, sent, optedOut, landline, log };
		});

		expect(result.noGateway).toEqual(expect.objectContaining({ status: 'skipped' }));
		expect(result.sent).toEqual({ status: 'sent', segments: 1, cost: 0.35 });
		expect(result.optedOut).toEqual(expect.objectContaining({ status: 'skipped' }));
		expect(result.landline).toEqual(expect.objectContaining({ status: 'skipped' }));
		// Only the one that was sent reached the gateway, and only it was logged.
		expect(calls).toHaveLength(1);
		const mine = result.log.filter((row) => row.body === 'ሰላም ለእናንተ');
		expect(mine).toEqual([
			expect.objectContaining({ status: 'sent', toPhone: '251911234567', segments: 1, cost: 0.35 })
		]);
	});
});
