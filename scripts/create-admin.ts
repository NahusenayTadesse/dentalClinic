/**
 * Creates a super-admin account, for when `/setup` is closed (it only runs on an empty `user`
 * table). The same command as in the admin-kit's other apps:
 *
 *     npm run admin:create -- --email you@clinic.test --name "Your Name"
 *     npm run admin:create -- --email you@clinic.test --name "Your Name" --password '…'
 *
 * Without `--password` a strong one is generated and printed once. The account is written the way
 * better-auth writes an email sign-up — a `user` row and a `credential` account holding the hash —
 * with what `/setup` gives the first admin on top: the Super Admin role (`roleId`, which every
 * permission is derived from), better-auth's own `role: 'admin'`, and the main branch.
 */
import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { hashPassword } from 'better-auth/crypto';
import { createClinicPool } from '../src/lib/server/db/connection';
import { account, roles, user } from '../src/lib/server/db/schema/user';
import { MAIN_BRANCH_ID } from '../src/lib/server/db/schema/mainBranch';

const SUPER_ADMIN_ROLE = 'Super Admin';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const { values } = parseArgs({
	options: {
		email: { type: 'string' },
		name: { type: 'string' },
		password: { type: 'string' }
	}
});

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
if (!email || !name) {
	console.error('Usage: npm run admin:create -- --email you@clinic.test --name "Your Name"');
	process.exit(1);
}
if (values.password !== undefined && values.password.length < 8) {
	console.error('The password must be at least 8 characters.');
	process.exit(1);
}

const password = values.password ?? randomBytes(12).toString('base64url');
const client = createClinicPool(process.env.DATABASE_URL);
const db = drizzle(client);

try {
	const [role] = await db
		.select({ id: roles.id })
		.from(roles)
		.where(eq(roles.name, SUPER_ADMIN_ROLE))
		.limit(1);
	const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));

	if (!role) {
		console.error(`There is no "${SUPER_ADMIN_ROLE}" role yet: run /setup first.`);
		process.exitCode = 1;
	} else if (existing) {
		console.error(`An account for ${email} already exists.`);
		process.exitCode = 1;
	} else {
		const userId = randomUUID();
		const hash = await hashPassword(password);
		await db.transaction(async (tx) => {
			await tx.insert(user).values({
				id: userId,
				name,
				email,
				emailVerified: true,
				role: 'admin',
				roleId: role.id,
				branchId: MAIN_BRANCH_ID
			});
			await tx.insert(account).values({
				id: randomUUID(),
				accountId: userId,
				providerId: 'credential',
				userId,
				password: hash
			});
		});
		console.log(`Created ${email} (${SUPER_ADMIN_ROLE}).`);
		if (!values.password) console.log(`Password (shown once): ${password}`);
	}
} finally {
	await client.end();
}
