/**
 * The cryptography two gateways need on our side: Telebirr signs every request with the clinic's
 * RSA key (RSA-PSS), and SantimPay with its EC key (an ES256 JWT). Both with `node:crypto` alone.
 *
 * **A key arrives however the gateway handed it over.** Ethio Telecom issues bare base64 DER with
 * no PEM lines; SantimPay's SDKs take base64 PKCS#8; a developer pastes PEM. `privateKeyFrom` takes
 * any of them, so the clinic pastes what it was given rather than converting it.
 */
import { constants, createPrivateKey, sign, type KeyObject } from 'node:crypto';

/** A private key from PEM, or from bare base64 DER in PKCS#8, PKCS#1 (RSA) or SEC1 (EC). */
export function privateKeyFrom(text: string): KeyObject {
	const pasted = text.trim().replace(/\\n/g, '\n');
	if (pasted.includes('-----BEGIN')) return createPrivateKey(pasted);
	const der = Buffer.from(pasted.replace(/\s+/g, ''), 'base64');
	for (const type of ['pkcs8', 'pkcs1', 'sec1'] as const) {
		try {
			return createPrivateKey({ key: der, format: 'der', type });
		} catch {
			// Not this encoding; try the next.
		}
	}
	throw new Error('The private key could not be read. Paste it exactly as the gateway gave it.');
}

/** Base64url, as a JWT spells it. */
function base64url(data: Buffer | string): string {
	return Buffer.from(data).toString('base64url');
}

/** A JWT over `claims`, signed ES256 — the signature in raw r‖s form, as JOSE requires. */
export function es256Jwt(claims: Record<string, unknown>, key: KeyObject): string {
	const head = base64url(JSON.stringify({ alg: 'ES256', typ: 'JWT' }));
	const body = base64url(JSON.stringify(claims));
	const signature = sign('sha256', Buffer.from(`${head}.${body}`), {
		key,
		dsaEncoding: 'ieee-p1363'
	});
	return `${head}.${body}.${base64url(signature)}`;
}

/** RSA-PSS over SHA-256 with a 32-byte salt, base64 — what Telebirr calls SHA256WithRSA. */
export function rsaPssSign(text: string, key: KeyObject): string {
	return sign('sha256', Buffer.from(text), {
		key,
		padding: constants.RSA_PKCS1_PSS_PADDING,
		saltLength: 32
	}).toString('base64');
}
