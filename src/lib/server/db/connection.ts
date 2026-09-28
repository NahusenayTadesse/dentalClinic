/**
 * The one way this app opens a MySQL/MariaDB connection: a pool whose sessions run in **UTC**.
 *
 * **Why.** Drizzle keeps every `datetime` and `timestamp` as its UTC wall clock — it writes
 * `toISOString()` without the `Z` and reads the value back as UTC. The database, left alone, runs
 * each session in the server's own zone (`SYSTEM`, which is EAT on the clinic's host). The two
 * agreed only where Drizzle did both halves. Wherever the database did one of them — a
 * `DEFAULT now()` on `created_at`, `ON UPDATE CURRENT_TIMESTAMP`, a `NOW()` stamped into
 * `deleted_at` — the value was the local clock read back as UTC: three hours late, so anything
 * made after nine at night was dated the next day, and `NOW()` compared against an appointment
 * was three hours off. A UTC session makes the database's clock speak Drizzle's convention.
 *
 * `timezone: 'Z'` is the driver's half of the same thing: a JavaScript `Date` passed as a raw
 * parameter (not through a column) is written as UTC rather than in the process's own zone.
 *
 * **What it does not do: say what day it is.** In a UTC session `CURDATE()` is the UTC date,
 * which is yesterday in Addis Ababa until three in the morning. "Today" comes from the clinic's
 * clock — `today()` in `db/dialect.ts`, `clinicToday()` in `$lib/clinicTime` — never `CURDATE()`.
 *
 * No SvelteKit imports, so the seed and other scripts use it too; a script that opened its own
 * connection would write local-time stamps again.
 */
import mysql from 'mysql2/promise';

/** The session time zone every connection is put in. */
export const SESSION_TIME_ZONE = '+00:00';

export function createClinicPool(url: string) {
	const pool = mysql.createPool({ uri: url, timezone: 'Z' });

	// Set on each new connection before it is handed out; queries on a connection run in order, so
	// nothing can run on it in the local zone first.
	pool.pool.on('connection', (connection) => {
		connection.query(`SET time_zone = '${SESSION_TIME_ZONE}'`);
	});

	return pool;
}
