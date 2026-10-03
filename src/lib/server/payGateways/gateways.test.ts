import { describe, expect, it } from 'vitest';
import { constants, createPublicKey, generateKeyPairSync, verify } from 'node:crypto';

import { startCheckout, verifyCheckout, referenceIn } from './index';
import { es256Jwt, privateKeyFrom, rsaPssSign } from './keys';
import { signingString } from './telebirr';
import type { CheckoutRequest, GatewayCredentials } from './types';

/**
 * Each gateway against a fake of itself: what it is sent, and how its answers are read. The shapes
 * are the ones each adapter documents; a live gateway cannot be reached from a test.
 */

/** A fake gateway: records each request, answers from `replies` in turn. */
function fakeFetch(...replies: { body: unknown; status?: number }[]) {
	const calls: { url: string; init: RequestInit | undefined }[] = [];
	const fetcher: typeof fetch = async (input, init) => {
		calls.push({ url: String(input), init });
		const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
		return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
	};
	return { fetcher, calls };
}

const sent = (call: { init: RequestInit | undefined }) => JSON.parse(String(call.init?.body));

const request: CheckoutRequest = {
	reference: 'DCABCDEFGH23456789',
	amount: 1500,
	phone: '0911 234 567',
	firstName: 'Abebe',
	lastName: 'Kebede',
	title: 'Bill INV-2019-0001',
	returnUrl: 'https://clinic.example/paid?ref=DCABCDEFGH23456789',
	cancelUrl: 'https://clinic.example/paid?ref=DCABCDEFGH23456789&cancelled=1',
	notifyUrl: 'https://clinic.example/api/payments/chapa'
};

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
/** As Ethio Telecom hands a key over: bare base64 DER, no PEM lines. */
const rsaBase64 = rsa.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const ecBase64 = ec.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');

describe('keys', () => {
	it('reads a private key as PEM or as bare base64', () => {
		const pem = String(rsa.privateKey.export({ format: 'pem', type: 'pkcs8' }));
		expect(privateKeyFrom(pem).asymmetricKeyType).toBe('rsa');
		expect(privateKeyFrom(rsaBase64).asymmetricKeyType).toBe('rsa');
		expect(privateKeyFrom(ecBase64).asymmetricKeyType).toBe('ec');
		expect(() => privateKeyFrom('not a key')).toThrow(/could not be read/);
	});

	it('signs a JWT the EC public key verifies', () => {
		const token = es256Jwt({ id: 'X', generated: 1 }, privateKeyFrom(ecBase64));
		const [head, body, signature] = token.split('.');
		expect(JSON.parse(Buffer.from(head, 'base64url').toString())).toEqual({
			alg: 'ES256',
			typ: 'JWT'
		});
		expect(
			verify(
				'sha256',
				Buffer.from(`${head}.${body}`),
				{ key: createPublicKey(ec.privateKey), dsaEncoding: 'ieee-p1363' },
				Buffer.from(signature, 'base64url')
			)
		).toBe(true);
	});

	it('signs RSA-PSS with a 32-byte salt', () => {
		const signature = rsaPssSign('a=1&b=2', privateKeyFrom(rsaBase64));
		expect(
			verify(
				'sha256',
				Buffer.from('a=1&b=2'),
				{ key: rsa.publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
				Buffer.from(signature, 'base64')
			)
		).toBe(true);
	});
});

describe('Chapa', () => {
	const account: GatewayCredentials = {
		mode: 'test',
		secrets: { secretKey: 'CHASECK_TEST-abc1234' },
		settings: {}
	};

	it('starts with the key as a bearer token, the amount as text and our reference', async () => {
		const { fetcher, calls } = fakeFetch({
			body: { status: 'success', data: { checkout_url: 'https://checkout.chapa.co/x' } }
		});
		expect(await startCheckout('chapa', account, request, fetcher)).toEqual({
			ok: true,
			checkoutUrl: 'https://checkout.chapa.co/x',
			sessionId: null
		});
		expect(calls[0].url).toBe('https://api.chapa.co/v1/transaction/initialize');
		expect(new Headers(calls[0].init?.headers).get('authorization')).toBe(
			'Bearer CHASECK_TEST-abc1234'
		);
		const body = sent(calls[0]);
		expect(body).toMatchObject({
			amount: '1500.00',
			currency: 'ETB',
			tx_ref: request.reference,
			phone_number: '0911234567'
		});
		// Chapa refuses anything but letters, digits, `-`, `_`, `.` and spaces in a description.
		expect(body.customization.description).toBe('Bill INV-2019-0001');
	});

	it('reads paid, not yet, and a refused key apart', async () => {
		const paid = fakeFetch({
			body: {
				status: 'success',
				data: { status: 'success', amount: '1500.00', currency: 'ETB', reference: 'AP1' }
			}
		});
		expect(
			await verifyCheckout('chapa', account, { reference: 'R', sessionId: null }, paid.fetcher)
		).toMatchObject({
			ok: true,
			state: 'paid',
			amount: 1500,
			currency: 'ETB',
			providerReference: 'AP1'
		});

		const notYet = fakeFetch({
			body: { message: 'Payment not paid yet', data: null },
			status: 400
		});
		expect(
			await verifyCheckout('chapa', account, { reference: 'R', sessionId: null }, notYet.fetcher)
		).toMatchObject({ ok: true, state: 'pending' });

		const badKey = fakeFetch({ body: { message: 'Invalid API Key' }, status: 401 });
		expect(
			await verifyCheckout('chapa', account, { reference: 'R', sessionId: null }, badKey.fetcher)
		).toEqual({ ok: false, error: 'Invalid API Key' });
	});

	it('finds our reference in the webhook and in the callback', () => {
		expect(referenceIn('chapa', { tx_ref: 'DC1', status: 'success' })).toBe('DC1');
		expect(referenceIn('chapa', { trx_ref: 'DC2' })).toBe('DC2');
		expect(referenceIn('chapa', 'nonsense')).toBeNull();
	});
});

describe('Telebirr', () => {
	const account: GatewayCredentials = {
		mode: 'test',
		secrets: { appSecret: 'app-secret', privateKey: rsaBase64 },
		settings: { fabricAppId: 'fabric-1', merchantAppId: 'app-1', shortCode: '123456' }
	};

	it('signs the fields with biz_content flattened in, sorted', () => {
		expect(
			signingString({
				timestamp: '1',
				method: 'payment.preorder',
				sign: 'x',
				sign_type: 'SHA256WithRSA',
				biz_content: { title: 'Bill', appid: 'a' }
			})
		).toBe('appid=a&method=payment.preorder&timestamp=1&title=Bill');
	});

	it('takes a token, pre-orders, and builds a signed checkout link', async () => {
		const { fetcher, calls } = fakeFetch(
			{ body: { token: 'fabric-token' } },
			{ body: { result: 'SUCCESS', biz_content: { prepay_id: 'prepay-9' } } }
		);
		const started = await startCheckout('telebirr', account, request, fetcher);
		expect(started.ok).toBe(true);
		if (!started.ok) return;
		expect(started.sessionId).toBe('prepay-9');

		expect(calls[0].url).toMatch(/:38443\/apiaccess\/payment\/gateway\/payment\/v1\/token$/);
		expect(new Headers(calls[0].init?.headers).get('x-app-key')).toBe('fabric-1');
		expect(sent(calls[0])).toEqual({ appSecret: 'app-secret' });

		const preOrder = sent(calls[1]);
		expect(new Headers(calls[1].init?.headers).get('authorization')).toBe('fabric-token');
		expect(preOrder.biz_content).toMatchObject({
			merch_order_id: request.reference,
			merch_code: '123456',
			appid: 'app-1',
			trade_type: 'Checkout',
			total_amount: '1500.00',
			// `-` is one of the characters Telebirr refuses in a title.
			title: 'Bill INV 2019 0001'
		});
		expect(
			verify(
				'sha256',
				Buffer.from(signingString(preOrder)),
				{ key: rsa.publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
				Buffer.from(preOrder.sign, 'base64')
			)
		).toBe(true);

		const url = started.checkoutUrl;
		expect(url).toMatch(/\/payment\/web\/paygate\?appid=app-1&merch_code=123456&nonce_str=/);
		expect(url).toContain('prepay_id=prepay-9');
		expect(url).toMatch(/&sign_type=SHA256WithRSA&version=1\.0&trade_type=Checkout$/);
	});

	it('reads PAY_SUCCESS as paid', async () => {
		const { fetcher } = fakeFetch(
			{ body: { token: 't' } },
			{
				body: {
					biz_content: {
						order_status: 'PAY_SUCCESS',
						total_amount: '1500.00',
						trans_currency: 'ETB',
						payment_order_id: 'T-77'
					}
				}
			}
		);
		expect(
			await verifyCheckout('telebirr', account, { reference: 'R', sessionId: null }, fetcher)
		).toMatchObject({ ok: true, state: 'paid', amount: 1500, providerReference: 'T-77' });
	});

	it('says so when the private key cannot be read, without the key', async () => {
		const broken = { ...account, secrets: { ...account.secrets, privateKey: 'garbage' } };
		const result = await startCheckout(
			'telebirr',
			broken,
			request,
			fakeFetch({ body: {} }).fetcher
		);
		expect(result).toEqual({
			ok: false,
			error: 'The private key could not be read. Paste it exactly as the gateway gave it.'
		});
	});
});

describe('ArifPay', () => {
	const account: GatewayCredentials = {
		mode: 'test',
		secrets: { apiKey: 'arif-key' },
		settings: { accountNumber: '01320811436100', bank: 'AWINETAA' }
	};

	it('starts a sandbox session paying the settlement account, and asks by session', async () => {
		const { fetcher, calls } = fakeFetch(
			{ body: { error: false, data: { sessionId: 'S-1', paymentUrl: 'https://pay.arifpay/S-1' } } },
			{
				body: {
					data: {
						nonce: request.reference,
						totalAmount: 1500,
						transaction: { transactionStatus: 'SUCCESS', transactionId: 'AT-1' }
					}
				}
			}
		);
		expect(await startCheckout('arifpay', account, request, fetcher)).toEqual({
			ok: true,
			checkoutUrl: 'https://pay.arifpay/S-1',
			sessionId: 'S-1'
		});
		expect(calls[0].url).toBe('https://gateway.arifpay.net/v0/sandbox/checkout/session');
		expect(new Headers(calls[0].init?.headers).get('x-arifpay-key')).toBe('arif-key');
		expect(sent(calls[0])).toMatchObject({
			nonce: request.reference,
			phone: '251911234567',
			beneficiaries: [{ accountNumber: '01320811436100', bank: 'AWINETAA', amount: 1500 }]
		});

		expect(
			await verifyCheckout(
				'arifpay',
				account,
				{ reference: request.reference, sessionId: 'S-1' },
				fetcher
			)
		).toMatchObject({ ok: true, state: 'paid', amount: 1500, providerReference: 'AT-1' });
		expect(calls[1].url).toBe('https://gateway.arifpay.net/v0/sandbox/checkout/session/S-1');
	});

	it('refuses an answer about someone else’s session', async () => {
		const { fetcher } = fakeFetch({
			body: { data: { nonce: 'OTHER', transaction: { transactionStatus: 'SUCCESS' } } }
		});
		expect(
			await verifyCheckout('arifpay', account, { reference: 'MINE', sessionId: 'S-1' }, fetcher)
		).toEqual({ ok: false, error: 'ArifPay answered about a different payment.' });
	});
});

describe('SantimPay', () => {
	const account: GatewayCredentials = {
		mode: 'live',
		secrets: { privateKey: ecBase64 },
		settings: { merchantId: 'merchant-uuid' }
	};

	it('signs the initiation and the status check with the merchant’s key', async () => {
		const { fetcher, calls } = fakeFetch(
			{ body: { url: 'https://checkout.santimpay.com/?a=1&amp;b=2' } },
			{ body: { Status: 'COMPLETED', amount: 1500, totalAmount: 1530, txnId: 'SP-1' } }
		);
		expect(await startCheckout('santimpay', account, request, fetcher)).toMatchObject({
			ok: true,
			checkoutUrl: 'https://checkout.santimpay.com/?a=1&b=2'
		});
		expect(calls[0].url).toBe('https://services.santimpay.com/api/v1/gateway/initiate-payment');
		const body = sent(calls[0]);
		expect(body).toMatchObject({
			id: request.reference,
			amount: 1500,
			phoneNumber: '+251911234567'
		});
		const claims = JSON.parse(Buffer.from(body.signedToken.split('.')[1], 'base64url').toString());
		expect(claims).toMatchObject({ amount: 1500, merchantId: 'merchant-uuid' });

		// `amount` before `totalAmount`, which may carry a fee.
		expect(
			await verifyCheckout(
				'santimpay',
				account,
				{ reference: request.reference, sessionId: null },
				fetcher
			)
		).toMatchObject({ ok: true, state: 'paid', amount: 1500, providerReference: 'SP-1' });
		const status = JSON.parse(
			Buffer.from(sent(calls[1]).signedToken.split('.')[1], 'base64url').toString()
		);
		expect(status).toMatchObject({ id: request.reference, merId: 'merchant-uuid' });
	});

	it('finds our id in the notification', () => {
		expect(referenceIn('santimpay', { thirdPartyId: 'DC9', txnId: 'SP-1' })).toBe('DC9');
	});
});

describe('the network', () => {
	it('turns a failed connection into a sentence', async () => {
		const down: typeof fetch = async () => {
			throw new TypeError('fetch failed');
		};
		expect(
			await startCheckout(
				'chapa',
				{ mode: 'test', secrets: { secretKey: 'k' }, settings: {} },
				request,
				down
			)
		).toEqual({
			ok: false,
			error: 'The gateway could not be reached. Check the internet connection.'
		});
	});
});
