/**
 * Encrypting the third-party credentials the clinic types in — an SMS gateway's API key — so the
 * database holds them unreadable.
 *
 * **Encrypted, not hashed.** A password is hashed because it is only ever compared. An API key must
 * be read back and sent to the gateway, so it is encrypted: AES-256-GCM, which also detects a
 * stored value that was tampered with or copied from another install (decryption throws rather than
 * returning garbage that would be sent as a key).
 *
 * **The key comes from the server's secret.** HKDF-SHA256 over `BETTER_AUTH_SECRET`, with a label
 * of its own, so a clinic configures nothing new and the encryption key never sits in the database
 * beside what it protects. A database backup, or someone reading the table, gets ciphertext.
 * The cost: **changing `BETTER_AUTH_SECRET` makes stored keys unreadable**, and they must be typed
 * in again. `decryptSecret` says so in its error rather than failing obscurely.
 *
 * Stored as `v1:<iv>:<tag>:<ciphertext>`, base64. The version is there so the scheme can change
 * without guessing which rows were written by which.
 *
 * Non-goals: protecting against someone who can read the server's environment — they have the
 * secret, and every session with it — and key rotation, which is re-entering the API key.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

const VERSION = 'v1';

/** The 32-byte key, derived once per process. */
let derived: Buffer | null = null;

function key(): Buffer {
	if (derived) return derived;
	const secret = env.BETTER_AUTH_SECRET;
	if (!secret || secret.length < 32) {
		throw new Error(
			'BETTER_AUTH_SECRET is missing or shorter than 32 characters, so stored keys cannot be encrypted.'
		);
	}
	derived = Buffer.from(hkdfSync('sha256', secret, 'clinic-secrets', 'stored-api-keys-v1', 32));
	return derived;
}

/** A secret, encrypted for storage. Every call gives a different ciphertext for the same secret. */
export function encryptSecret(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key(), iv);
	const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [VERSION, iv, tag, body]
		.map((part) => (typeof part === 'string' ? part : part.toString('base64')))
		.join(':');
}

/** A stored secret, decrypted. Throws when it was written under another server secret, or altered. */
export function decryptSecret(stored: string): string {
	const [version, iv, tag, body] = stored.split(':');
	if (version !== VERSION || !iv || !tag || !body) {
		throw new Error('A stored key is not in a format this version can read. Enter it again.');
	}
	try {
		const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
		decipher.setAuthTag(Buffer.from(tag, 'base64'));
		return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString(
			'utf8'
		);
	} catch {
		throw new Error(
			'A stored key could not be decrypted — BETTER_AUTH_SECRET has changed since it was saved, or the row was altered. Enter the key again.'
		);
	}
}

/** The last four characters, for showing which key is in use without showing the key. */
export function secretHint(plain: string): string {
	return plain.length <= 4 ? '••••' : `••••${plain.slice(-4)}`;
}
