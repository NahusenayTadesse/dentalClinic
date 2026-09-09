import { expect, it } from 'vitest';
import { resetSeededApprovals, seedApprovals } from './seedApprovals';

// Seeding entry points, not tests. They write to the developer's database, so they are skipped
// unless explicitly asked for — otherwise `npx vitest run` would mutate the data other tests
// read, and the suite would race against itself.
//
//   SEED_APPROVALS=1  npx vitest run src/lib/server/seedApprovals.test.ts
//   RESET_APPROVALS=1 npx vitest run src/lib/server/seedApprovals.test.ts
const seeding = process.env.SEED_APPROVALS === '1';
const resetting = process.env.RESET_APPROVALS === '1';

it.runIf(seeding)('seeds pending records into every approval queue', async () => {
	const seeded = await seedApprovals(3);
	for (const [queue, n] of Object.entries(seeded)) console.log(`  ${queue}: ${n} pending`);
	expect(Object.keys(seeded).length).toBeGreaterThan(0);
});

it.runIf(resetting)('returns every approval queue to empty', async () => {
	const reset = await resetSeededApprovals();
	for (const [queue, n] of Object.entries(reset)) if (n) console.log(`  ${queue}: ${n} restored`);
	expect(Object.keys(reset).length).toBeGreaterThan(0);
});
