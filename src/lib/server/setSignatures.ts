import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './db/schema';
import { employee } from './db/schema';

async function main() {
	const client = mysql.createPool(process.env.DATABASE_URL!);
	const db = drizzle(client, { schema, mode: 'default' });

	const result = await db.update(employee).set({ signiture: '81.jpg' });

	console.log(`✅ Set signiture = '81.jpg' for all employees.`);
	await client.end();
}

main().catch((err) => {
	console.error('❌ Update failed:', err);
	process.exit(1);
});
