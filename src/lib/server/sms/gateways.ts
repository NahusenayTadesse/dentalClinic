/**
 * The SMS gateways, each behind one function: send this text to this number with this key.
 *
 * Adding a gateway is a value in `SMS_PROVIDERS` and an entry here — nothing else in the app knows
 * which one is in use. The request shapes are taken from the gateways' own client libraries:
 *
 *   - **AfroMessage** — `GET https://api.afromessage.com/api/send`, the key as a bearer token, and
 *     `from` (identifier), `sender`, `to`, `message` in the query. Success is
 *     `{ acknowledge: 'success', response: { message_id, … } }`.
 *   - **GeezSMS** — `POST https://api.geezsms.com/api/v1/sms/send`, JSON with `token`, `phone`,
 *     `msg` and an optional `shortcode_id`; a phone must start 2519, and a message is at most 335
 *     characters.
 *
 * **Errors never carry the key.** What comes back as `error` is stored in the message log and shown
 * on screen, so it is built from the gateway's reply or the network's error, never from the request.
 *
 * Non-goals: delivery reports (a callback URL would need this server to be reachable from the
 * internet, which a clinic's local install is not), and bulk sends — a day's reminders are a few
 * dozen single sends, and each gets its own log row and its own failure.
 */
import type { SmsProviderName } from '$lib/smsTemplates';

/** What a send needs. `to` is already in international form (`ethiopianMobile`). */
export type GatewayRequest = {
	apiKey: string;
	to: string;
	message: string;
	senderName: string | null;
	senderId: string | null;
};

/** What a send came to. */
export type GatewayResult = { ok: true; messageId: string | null } | { ok: false; error: string };

/** One gateway. */
type Gateway = (request: GatewayRequest, fetcher: typeof fetch) => Promise<GatewayResult>;

/** Long enough for a slow mobile network, short enough that a hung gateway does not hang the desk. */
const TIMEOUT_MS = 15_000;

/** A short, key-free reason from whatever the gateway returned. */
function reason(body: unknown, status: number): string {
	if (body && typeof body === 'object') {
		for (const field of ['response', 'msg', 'message', 'error', 'errors']) {
			const value: unknown = Reflect.get(body, field);
			if (typeof value === 'string' && value) return value.slice(0, 200);
			if (value && typeof value === 'object') {
				const errors: unknown = Reflect.get(value, 'errors');
				if (Array.isArray(errors) && errors.length) return String(errors[0]).slice(0, 200);
			}
		}
	}
	return `The gateway answered ${status}.`;
}

/** The reply as JSON, or null when it was not. */
async function json(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

const afromessage: Gateway = async (request, fetcher) => {
	const url = new URL('https://api.afromessage.com/api/send');
	if (request.senderId) url.searchParams.set('from', request.senderId);
	if (request.senderName) url.searchParams.set('sender', request.senderName);
	url.searchParams.set('to', request.to);
	url.searchParams.set('message', request.message);

	const response = await fetcher(url, {
		headers: { Authorization: `Bearer ${request.apiKey}`, Accept: 'application/json' },
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	const body = await json(response);
	const acknowledged =
		body && typeof body === 'object' && Reflect.get(body, 'acknowledge') === 'success';
	if (!response.ok || !acknowledged) return { ok: false, error: reason(body, response.status) };
	const detail: unknown = Reflect.get(body, 'response');
	const id = detail && typeof detail === 'object' ? Reflect.get(detail, 'message_id') : null;
	return { ok: true, messageId: id === null || id === undefined ? null : String(id) };
};

const geezsms: Gateway = async (request, fetcher) => {
	const response = await fetcher('https://api.geezsms.com/api/v1/sms/send', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			token: request.apiKey,
			phone: request.to,
			msg: request.message,
			...(request.senderId ? { shortcode_id: request.senderId } : {})
		}),
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	const body = await json(response);
	const failed =
		!response.ok || (body && typeof body === 'object' && Reflect.get(body, 'error') === true);
	if (failed) return { ok: false, error: reason(body, response.status) };
	const data: unknown = body && typeof body === 'object' ? Reflect.get(body, 'data') : null;
	const id =
		data && typeof data === 'object'
			? (Reflect.get(data, 'message_id') ?? Reflect.get(data, 'id'))
			: null;
	return { ok: true, messageId: id === null || id === undefined ? null : String(id) };
};

const GATEWAYS: Record<SmsProviderName, Gateway> = { afromessage, geezsms };

/** How each gateway is named on screen. */
export const GATEWAY_NAMES: Record<SmsProviderName, string> = {
	afromessage: 'AfroMessage',
	geezsms: 'GeezSMS'
};

/**
 * Sends one message through a gateway. Never throws: a network failure, a timeout or a refusal is
 * a `{ ok: false }` with a reason, so a day's list of reminders carries on past one bad number.
 * `fetcher` is for tests.
 */
export async function sendThrough(
	provider: SmsProviderName,
	request: GatewayRequest,
	fetcher: typeof fetch = fetch
): Promise<GatewayResult> {
	if (provider === 'geezsms' && request.message.length > 335) {
		return { ok: false, error: 'GeezSMS takes at most 335 characters; shorten the template.' };
	}
	try {
		return await GATEWAYS[provider](request, fetcher);
	} catch (err: unknown) {
		const timedOut = err instanceof Error && err.name === 'TimeoutError';
		return {
			ok: false,
			error: timedOut
				? 'The gateway did not answer in time.'
				: 'The gateway could not be reached. Check the internet connection.'
		};
	}
}
