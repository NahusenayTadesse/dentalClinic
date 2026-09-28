import { drizzle } from 'drizzle-orm/mysql2';
import { createClinicPool } from './connection';
import * as schema from '$lib/server/db/schema/';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// UTC sessions, so the database's clock agrees with Drizzle's — see `connection.ts`.
const client = createClinicPool(env.DATABASE_URL);

export const db = drizzle(client, { schema, mode: 'default' });
