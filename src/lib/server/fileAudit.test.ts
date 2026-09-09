import { expect, it } from 'vitest';
import { auditFiles } from './fileAudit';

/**
 * A maintenance entry point, not a test — the same shape as `seedApprovals.test.ts`.
 *
 * It reads the developer's database and their file store, so it is skipped unless asked for.
 * Run it when you want to know what the store is carrying:
 *
 *   AUDIT_FILES=1 npx vitest run src/lib/server/fileAudit.test.ts
 *
 * It reports and never deletes. An orphan may be a genuinely abandoned file, or it may be one
 * whose owning row is about to be restored — nothing here can tell the difference, so the
 * decision stays with a person.
 */
const auditing = process.env.AUDIT_FILES === '1';

it.runIf(auditing)('reconciles the file store against the database', async () => {
	const { orphans, missing, onDisk, referenced } = await auditFiles();

	console.log(`  on disk:    ${onDisk}`);
	console.log(`  referenced: ${referenced}`);
	console.log(`  orphans:    ${orphans.length}`);
	for (const name of orphans.slice(0, 20)) console.log(`    ${name}`);
	if (orphans.length > 20) console.log(`    … and ${orphans.length - 20} more`);
	console.log(`  missing:    ${missing.length}`);
	for (const name of missing.slice(0, 20)) console.log(`    ${name}`);

	// The audit itself must not be the thing that is broken.
	expect(Number.isInteger(onDisk)).toBe(true);
	expect(Number.isInteger(referenced)).toBe(true);
});
