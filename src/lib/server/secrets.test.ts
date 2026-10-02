import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, secretHint } from './secrets';

describe('stored secrets', () => {
	it('gets back what was put in, never storing it readable', () => {
		const stored = encryptSecret('sk_live_abc123XYZ');
		expect(stored).not.toContain('abc123');
		expect(stored.startsWith('v1:')).toBe(true);
		expect(decryptSecret(stored)).toBe('sk_live_abc123XYZ');
	});

	it('writes a different ciphertext each time', () => {
		expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
	});

	it('refuses a value that was altered, rather than returning garbage as a key', () => {
		const [v, iv, tag, body] = encryptSecret('sk_live_abc123XYZ').split(':');
		const flipped = Buffer.from(body, 'base64');
		flipped[0] ^= 1;
		expect(() => decryptSecret([v, iv, tag, flipped.toString('base64')].join(':'))).toThrow(
			/could not be decrypted/
		);
		expect(() => decryptSecret('plain-text-key')).toThrow(/Enter it again/);
	});

	it('shows only the last four characters', () => {
		expect(secretHint('sk_live_abc123XYZ')).toBe('••••3XYZ');
		expect(secretHint('abc')).toBe('••••');
	});
});
