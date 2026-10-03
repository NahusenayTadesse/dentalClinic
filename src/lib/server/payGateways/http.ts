/**
 * What every gateway adapter does the same way: a timeout, reading a reply that may not be JSON,
 * digging a field out of it, and turning a failure into a sentence that never carries a key.
 */

/** Long enough for a slow connection, short enough that a hung gateway does not hang the desk. */
export const TIMEOUT_MS = 20_000;

/** The reply as JSON, or null when it was not. */
export async function readJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

/** `value.a.b.c`, or undefined where any step is missing. */
export function pick(value: unknown, ...path: string[]): unknown {
	let at: unknown = value;
	for (const key of path) {
		if (!at || typeof at !== 'object') return undefined;
		at = Reflect.get(at, key);
	}
	return at;
}

/** A field as a string, or null — for ids that arrive as numbers from one gateway and text from another. */
export function text(value: unknown): string | null {
	if (typeof value === 'string' && value) return value;
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return null;
}

/** A field as a number of birr, or null. */
export function money(value: unknown): number | null {
	const n = typeof value === 'string' ? Number(value) : value;
	return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** A short, key-free reason from whatever the gateway returned. */
export function reason(body: unknown, status: number): string {
	for (const path of [['message'], ['msg'], ['error'], ['errorMsg'], ['data', 'message']]) {
		const value = pick(body, ...path);
		if (typeof value === 'string' && value) return value.slice(0, 200);
		// Chapa returns validation messages as `{ message: { field: ['…'] } }`.
		if (value && typeof value === 'object') {
			const first = Object.values(value)[0];
			if (Array.isArray(first) && typeof first[0] === 'string') return first[0].slice(0, 200);
		}
	}
	return `The gateway answered ${status}.`;
}

/** The network's failure as a sentence: a timeout, or no connection at all. */
export function networkFailure(err: unknown): string {
	return err instanceof Error && err.name === 'TimeoutError'
		? 'The gateway did not answer in time.'
		: 'The gateway could not be reached. Check the internet connection.';
}

/** Two decimals, as the gateways that take the amount as text want it. */
export function birr(amount: number): string {
	return (Math.round(amount * 100) / 100).toFixed(2);
}
