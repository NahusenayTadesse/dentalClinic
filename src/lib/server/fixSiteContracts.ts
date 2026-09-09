// One-off data fix: site_contracts.site_id was 0 on every row while customer_id actually
// held the site's id (confirmed: every stored "customer_id" value matches a real site.id,
// several of which - 24, 26, 28, 29, 30 - aren't even valid customers.id values). This
// restores site_id to the correct site and customer_id to that site's real owning customer.
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './db/schema';
import { eq } from 'drizzle-orm';
import { site, siteContracts } from './db/schema';

async function main() {
	const client = mysql.createPool(process.env.DATABASE_URL!);
	const db = drizzle(client, { schema, mode: 'default' });

	const contracts = await db.select().from(siteContracts);
	const sites = await db.select().from(site);
	const siteById = new Map(sites.map((s) => [s.id, s]));

	let fixed = 0;
	for (const c of contracts) {
		const matchedSite = siteById.get(c.customerId);
		if (!matchedSite) {
			console.warn(`Skipping contract ${c.id}: no site found with id ${c.customerId}`);
			continue;
		}
		await db
			.update(siteContracts)
			.set({ siteId: matchedSite.id, customerId: matchedSite.customerId })
			.where(eq(siteContracts.id, c.id));
		console.log(
			`Contract ${c.id}: site_id 0 -> ${matchedSite.id} (${matchedSite.name}), customer_id ${c.customerId} -> ${matchedSite.customerId}`
		);
		fixed++;
	}

	console.log(`\n✅ Fixed ${fixed}/${contracts.length} site_contracts rows.`);
	await client.end();
}

main().catch((err) => {
	console.error('❌ Fix failed:', err);
	process.exit(1);
});
