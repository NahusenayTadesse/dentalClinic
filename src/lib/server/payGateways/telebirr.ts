/**
 * Telebirr's H5 web checkout, through Ethio Telecom's Fabric gateway. The official guide sits on a
 * portal that needs an account; the shapes here follow it as the maintained open-source clients
 * (telebirr-js, confirmed against production in 2026) implement it.
 *
 *   1. A **fabric token**: `POST /payment/v1/token` with the fabric app id as `X-APP-Key` and the app
 *      secret in the body. Asked for each call — a checkout is a handful of calls, and a cached token
 *      is one more thing to expire at the wrong moment.
 *   2. **preOrder**: `POST /payment/v1/merchant/preOrder`, signed, our reference as
 *      `merch_order_id`. Answers `biz_content.prepay_id`.
 *   3. The **checkout URL** is built here, not fetched: the web pay gate's address with `appid`,
 *      `merch_code`, `nonce_str`, `prepay_id` and `timestamp`, signed, then `version` and
 *      `trade_type`. The signature goes in as the reference clients send it, unencoded.
 *   4. **queryOrder** verifies: `PAY_SUCCESS` is paid.
 *
 * **Signing**: every field but `sign`, `sign_type` and `biz_content`, with `biz_content`'s own fields
 * flattened in, sorted by key and joined `k=v&k=v`, then RSA-PSS over SHA-256 with a 32-byte salt
 * (`keys.ts`) — though the request calls it `SHA256WithRSA`.
 *
 * Live and test are different hosts, both on port 38443. Telebirr's notification is signed too; it
 * is not checked, because nothing in it is believed — it only says which order to ask about.
 */
import { randomBytes } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import type { GatewayAdapter, GatewayCredentials } from './types';
import { birr, money, pick, readJson, reason, text, TIMEOUT_MS } from './http';
import { privateKeyFrom, rsaPssSign } from './keys';

const HOSTS = {
	test: 'https://developerportal.ethiotelebirr.et:38443',
	live: 'https://superapp.ethiomobilemoney.et:38443'
} as const;

const api = (account: GatewayCredentials) => `${HOSTS[account.mode]}/apiaccess/payment/gateway`;

/** Fields left out of the string that is signed. */
const UNSIGNED = new Set(['sign', 'sign_type', 'biz_content']);

/** The string Telebirr signs: the fields and `biz_content`'s, sorted, `k=v` joined by `&`. */
export function signingString(request: Record<string, unknown>): string {
	const flat: Record<string, string> = {};
	for (const [key, value] of Object.entries(request)) {
		if (UNSIGNED.has(key) || value === undefined || value === null) continue;
		flat[key] = String(value);
	}
	const biz = request.biz_content;
	if (biz && typeof biz === 'object') {
		for (const [key, value] of Object.entries(biz)) {
			if (value !== undefined && value !== null) flat[key] = String(value);
		}
	}
	return Object.keys(flat)
		.sort()
		.map((key) => `${key}=${flat[key]}`)
		.join('&');
}

/** A request with its signature. */
function signed(request: Record<string, unknown>, key: KeyObject) {
	return { ...request, sign: rsaPssSign(signingString(request), key), sign_type: 'SHA256WithRSA' };
}

const nonce = () => randomBytes(16).toString('hex');
const now = () => String(Math.floor(Date.now() / 1000));

/** Telebirr refuses a title with any of these. */
const plain = (s: string) => s.replace(/[~`!#$%^*()\-+=|/<>?;:"[\]{}\\&]/g, ' ').slice(0, 200);

/** The fabric token, or the gateway's reason for refusing it. */
async function fabricToken(
	account: GatewayCredentials,
	fetcher: typeof fetch
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
	const response = await fetcher(`${api(account)}/payment/v1/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-APP-Key': account.settings.fabricAppId },
		body: JSON.stringify({ appSecret: account.secrets.appSecret }),
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	const body = await readJson(response);
	const token = text(pick(body, 'token'));
	return response.ok && token
		? { ok: true, token }
		: { ok: false, error: reason(body, response.status) };
}

/** A signed call with the token. */
async function call(
	account: GatewayCredentials,
	path: string,
	request: Record<string, unknown>,
	token: string,
	fetcher: typeof fetch
) {
	const response = await fetcher(`${api(account)}${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-APP-Key': account.settings.fabricAppId,
			Authorization: token
		},
		body: JSON.stringify(signed(request, privateKeyFrom(account.secrets.privateKey))),
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	return { response, body: await readJson(response) };
}

export const telebirr: GatewayAdapter = {
	async start(account, request, fetcher) {
		const key = privateKeyFrom(account.secrets.privateKey);
		const auth = await fabricToken(account, fetcher);
		if (!auth.ok) return auth;
		const { response, body } = await call(
			account,
			'/payment/v1/merchant/preOrder',
			{
				timestamp: now(),
				nonce_str: nonce(),
				method: 'payment.preorder',
				version: '1.0',
				biz_content: {
					notify_url: request.notifyUrl,
					redirect_url: request.returnUrl,
					appid: account.settings.merchantAppId,
					merch_code: account.settings.shortCode,
					merch_order_id: request.reference,
					trade_type: 'Checkout',
					title: plain(request.title),
					total_amount: birr(request.amount),
					trans_currency: 'ETB',
					timeout_express: '120m'
				}
			},
			auth.token,
			fetcher
		);
		const prepayId = text(pick(body, 'biz_content', 'prepay_id'));
		if (!response.ok || !prepayId) return { ok: false, error: reason(body, response.status) };

		const parts = {
			appid: account.settings.merchantAppId,
			merch_code: account.settings.shortCode,
			nonce_str: nonce(),
			prepay_id: prepayId,
			timestamp: now()
		};
		const query = signingString(parts);
		const url = `${HOSTS[account.mode]}/payment/web/paygate?${query}&sign=${rsaPssSign(query, key)}&sign_type=SHA256WithRSA&version=1.0&trade_type=Checkout`;
		return { ok: true, checkoutUrl: url, sessionId: prepayId };
	},

	async verify(account, payment, fetcher) {
		const auth = await fabricToken(account, fetcher);
		if (!auth.ok) return auth;
		const { response, body } = await call(
			account,
			'/payment/v1/merchant/queryOrder',
			{
				timestamp: now(),
				nonce_str: nonce(),
				method: 'payment.queryorder',
				version: '1.0',
				biz_content: {
					appid: account.settings.merchantAppId,
					merch_code: account.settings.shortCode,
					merch_order_id: payment.reference
				}
			},
			auth.token,
			fetcher
		);
		const status =
			text(pick(body, 'biz_content', 'order_status')) ??
			text(pick(body, 'biz_content', 'trade_status'));
		if (!response.ok || !status) return { ok: false, error: reason(body, response.status) };
		return {
			ok: true,
			state:
				status === 'PAY_SUCCESS'
					? 'paid'
					: status === 'PAY_FAILED' || status === 'PAY_CANCEL' || status === 'ORDER_CLOSED'
						? 'failed'
						: 'pending',
			amount: money(pick(body, 'biz_content', 'total_amount')),
			currency: text(pick(body, 'biz_content', 'trans_currency')),
			providerReference: text(pick(body, 'biz_content', 'payment_order_id')),
			providerStatus: status
		};
	},

	referenceFrom(body) {
		// Sometimes wrapped in a `data` envelope.
		return text(pick(body, 'merch_order_id')) ?? text(pick(body, 'data', 'merch_order_id'));
	}
};
