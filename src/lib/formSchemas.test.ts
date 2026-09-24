import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

/**
 * A form's `status` field must default to `true`.
 *
 * Superforms fills a required boolean with `false` when nothing has been chosen, so an add dialog
 * nobody touched posts `status: false` and `contentCrud` writes `is_active = 0`. The row is created
 * switched off: invisible in every picker, absent from the lists that filter on it, and with
 * nothing on screen to say why. It was live on twenty-one screens — an allergen added through the
 * dialog arrived inactive — and the dialog even pre-selected "Inactive" as its answer.
 *
 * `.optional()` is the other honest spelling, for a form that genuinely leaves the flag alone.
 *
 * Reads the source rather than importing the schemas: they are spread across forty route files,
 * and this way the failure names the file to fix.
 */
const ROUTES = join(process.cwd(), 'src');

function schemaFiles(dir: string): string[] {
	const found: string[] = [];

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) found.push(...schemaFiles(full));
		else if (entry.name.endsWith('schema.ts') || entry.name.endsWith('Schemas.ts'))
			found.push(full);
	}

	return found;
}

describe('status fields', () => {
	it('default to active, so a row is never added switched off', () => {
		const offenders = schemaFiles(ROUTES)
			.flatMap((file) =>
				readFileSync(file, 'utf8')
					.split('\n')
					.map((line, i) => ({ file, line, number: i + 1 }))
			)
			.filter(({ line }) => /\bstatus: z\.boolean\(/.test(line))
			.filter(({ line }) => !line.includes('.default(') && !line.includes('.optional()'))
			.map(({ file, number }) => `${file.split(sep).slice(-4).join('/')}:${number}`);

		expect(
			offenders,
			`these post status: false when nobody picks one — add .default(true):\n  ${offenders.join('\n  ')}`
		).toEqual([]);
	});
});
