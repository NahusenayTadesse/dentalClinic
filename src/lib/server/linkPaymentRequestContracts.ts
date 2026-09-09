// One-off data fix: now that site_contracts.site_id is correct (see fixSiteContracts.ts),
// backfill payment_request.contract_id for any row where a contract exists for that site
// and the request's requestDate falls within the contract's [start_date, end_date] window.
// Leaves contract_id null where no contract covers that site/date (e.g. sites with no
// contract on file, or a request date outside every contract's range).
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './db/schema';
import { eq, isNull } from 'drizzle-orm';
import { siteContracts, paymentRequest } from './db/schema';

async function main() {
	const client = mysql.createPool(process.env.DATABASE_URL!);
	const db = drizzle(client, { schema, mode: 'default' });

	const contracts = await db.select().from(siteContracts);
	const contractsBySite = new Map<number, typeof contracts>();
	for (const c of contracts) {
		const list = contractsBySite.get(c.siteId) ?? [];
		list.push(c);
		contractsBySite.set(c.siteId, list);
	}

	const requests = await db
		.select()
		.from(paymentRequest)
		.where(isNull(paymentRequest.contractId));

	let linked = 0;
	let skippedNoContract = 0;
	let skippedNoMatch = 0;
	let skippedDuplicate = 0;

	// Track (contractId, month, year) combos already assigned in this run, since the
	// unique_payment_per_month index would otherwise reject a second request for the
	// same contract/period (e.g. two pre-existing rows for the same site+month).
	const usedKeys = new Set<string>();

	for (const r of requests) {
		const candidates = contractsBySite.get(r.siteId);
		if (!candidates || candidates.length === 0) {
			skippedNoContract++;
			continue;
		}

		const reqDate = new Date(r.requestDate);
		const matching = candidates.filter((c) => {
			const start = new Date(c.startDate);
			const end = new Date(c.endDate);
			return start <= reqDate && reqDate <= end;
		});

		if (matching.length === 0) {
			skippedNoMatch++;
			continue;
		}

		// Prefer the most recently started contract when more than one covers the date.
		matching.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
		const chosen = matching[0];

		const key = `${chosen.id}_${r.month}_${r.year}`;
		if (usedKeys.has(key)) {
			skippedDuplicate++;
			continue;
		}
		usedKeys.add(key);

		await db
			.update(paymentRequest)
			.set({ contractId: chosen.id })
			.where(eq(paymentRequest.id, r.id));
		linked++;
	}

	console.log(`✅ Linked ${linked} payment requests to a contract.`);
	console.log(`   Skipped (site has no contract on file): ${skippedNoContract}`);
	console.log(`   Skipped (no contract covers the request date): ${skippedNoMatch}`);
	console.log(`   Skipped (would duplicate contract+month+year): ${skippedDuplicate}`);

	await client.end();
}

main().catch((err) => {
	console.error('❌ Link failed:', err);
	process.exit(1);
});
