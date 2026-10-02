/**
 * Who may trigger a scheduled job: a cron line presenting the job's secret.
 *
 * cPanel's cron calls each job's URL with the secret in a header:
 *
 *     curl -fsS -H "Authorization: Bearer $SECRET" https://your-domain/api/cron/<job>
 *
 * The secret travels in a header rather than the query string, so it stays out of access logs,
 * proxy logs and Referer headers (a `?secret=` fallback exists for cron setups that cannot send
 * one). A missing secret refuses the job outright, and a wrong one gets a plain 404 — the same as
 * any URL that does not exist — so probing cannot confirm a job is there.
 *
 * Shared by every job under `/api/cron` (the leave accrual, the backup); it was the leave job's own
 * until there was a second.
 */
import { error } from '@sveltejs/kit';

/** Length-independent comparison, so timing cannot be used to recover the secret. */
function secretMatches(provided: string, expected: string): boolean {
	if (provided.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < provided.length; i++) {
		diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
	}
	return diff === 0;
}

/** The secret a request presents: the bearer header, or the query-string fallback. */
function presentedSecret(request: Request, url: URL): string {
	const header = request.headers.get('authorization') ?? '';
	if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
	return url.searchParams.get('secret') ?? '';
}

/**
 * Refuses a cron request that does not present `expected` — with a 404, logged under `job` when the
 * secret was never configured, since that is a setup mistake somebody needs to see.
 */
export function requireCronSecret(
	request: Request,
	url: URL,
	expected: string | undefined,
	job: string
): void {
	if (!expected) {
		console.error(`[${job}] its cron secret is not set — refusing to run`);
		error(404, 'Not found');
	}
	if (!secretMatches(presentedSecret(request, url), expected)) error(404, 'Not found');
}
