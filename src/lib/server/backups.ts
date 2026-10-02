/**
 * Backing the database up, keeping a copy somewhere else, and proving a backup restores.
 *
 * **Why the app does this itself.** `/dashboard/backup` bundled whatever dump file something outside
 * the app had left in `backups/`, and nothing in the repo wrote one — so whether a clinic had a
 * backup at all depended on a cron line nobody could see from here. Power cuts and failing disks are
 * ordinary in a clinic's server cupboard; a backup that may or may not exist is not one.
 *
 * Three things, each recorded in `job_run` so the screen can say when they last worked:
 *
 *   - **make** — `mariadb-dump` (or `mysqldump`) of the whole database, consistent without locking
 *     (`--single-transaction`), gzipped into `backups/`. The newest `KEEP` are kept.
 *   - **copy** — the same file into `BACKUP_COPY_DIR` when it is set: a USB drive, a second machine's
 *     share. A copy on the same disk survives a mistake, not a dead disk. Works with no internet.
 *   - **verify** — the newest backup loaded into a scratch database, the core tables counted, and
 *     the scratch database dropped. A backup nobody has restored is a hope, not a backup.
 *
 * The password reaches the dump tool through `MYSQL_PWD`, never the command line, where any user on
 * the machine could read it from the process list.
 *
 * Non-goals: other engines (a SQLite install copies its file; a Postgres one uses `pg_dump` — both
 * noted in PORTABILITY.md), uploading to a cloud service (which one is the clinic's choice, and a
 * synced folder pointed at by `BACKUP_COPY_DIR` does it), and restoring over the live database,
 * which is a decision for a person at a keyboard, not a button.
 */
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, readdir, rm, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import { and, desc, eq, inArray } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';

import { db } from '$lib/server/db';
import { jobRun } from '$lib/server/db/schema';
import { clinicClock, clinicDate } from '$lib/clinicTime';

/** Where backups are written. Outside the static and upload folders, so nothing serves them. */
export const BACKUP_DIR = path.join(process.cwd(), 'backups');

/** How many backups are kept, here and in the copy. Two weeks of dailies. */
export const KEEP = 14;

/** The backup file's extension: a gzipped SQL dump. `.pulsedata` is the old name, still read. */
const EXTENSIONS = ['.amno', '.pulsedata'];

export const BACKUP_JOB = 'backup';
export const VERIFY_JOB = 'backup-verify';

/** The tables whose rows a verified backup must hold: the clinic's record, if nothing else. */
const CORE_TABLES = ['patient', 'appointment', 'invoice', 'procedures'] as const;

type Trigger = 'cron' | 'manual';

/** The database the app is connected to, from `DATABASE_URL`. */
function connection() {
	const url = new URL(env.DATABASE_URL ?? '');
	return {
		host: url.hostname,
		port: url.port || '3306',
		user: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
		database: url.pathname.slice(1)
	};
}

/**
 * Runs the first of `programs` that exists, with `stdin`/`stdout` wired as given, and resolves when
 * it exits cleanly. `mariadb-dump` is tried before `mysqldump`, which newer MariaDB deprecates.
 */
async function run(
	programs: string[],
	args: string[],
	io: { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream },
	password: string
): Promise<void> {
	for (const program of programs) {
		const missing = await new Promise<boolean>((resolve, reject) => {
			const child = spawn(program, args, {
				env: { ...process.env, MYSQL_PWD: password },
				stdio: [io.input ? 'pipe' : 'ignore', io.output ? 'pipe' : 'ignore', 'pipe']
			});
			let stderr = '';
			child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
			child.on('error', (err: NodeJS.ErrnoException) =>
				err.code === 'ENOENT' ? resolve(true) : reject(err)
			);
			if (io.input && child.stdin) io.input.pipe(child.stdin);
			if (io.output && child.stdout) child.stdout.pipe(io.output);
			child.on('close', (code) => {
				if (code === 0) resolve(false);
				// The tool's own words, minus anything that is not about the failure.
				else
					reject(
						new Error(stderr.trim().split('\n').slice(-2).join(' ') || `${program} exited ${code}`)
					);
			});
		});
		if (!missing) return;
	}
	throw new Error(`None of ${programs.join(', ')} is installed on the server.`);
}

/** A run of a job, recorded as it starts; `finish` records how it ended. */
async function startRun(jobName: string, trigger: Trigger) {
	const [row] = await db
		.insert(jobRun)
		.values({ jobName, trigger, status: 'running' })
		.$returningId();
	return {
		async finish(outcome: { ok: true; summary: string } | { ok: false; error: string }) {
			await db
				.update(jobRun)
				.set(
					outcome.ok
						? { status: 'success', finishedAt: new Date(), summary: outcome.summary.slice(0, 500) }
						: { status: 'failed', finishedAt: new Date(), error: outcome.error.slice(0, 500) }
				)
				.where(eq(jobRun.id, row.id));
		}
	};
}

/** The backups in a folder, newest first. */
async function filesIn(dir: string) {
	const names = await readdir(dir).catch(() => [] as string[]);
	const files = await Promise.all(
		names
			.filter((name) => EXTENSIONS.some((ext) => name.endsWith(ext)))
			.map(async (name) => {
				const info = await stat(path.join(dir, name));
				return { name, size: info.size, at: info.mtime };
			})
	);
	return files.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Keeps the newest `KEEP` backups in a folder and removes the rest. */
async function prune(dir: string) {
	const files = await filesIn(dir);
	await Promise.all(files.slice(KEEP).map((f) => unlink(path.join(dir, f.name))));
}

/** The backups on the server, newest first. */
export function listBackups() {
	return filesIn(BACKUP_DIR);
}

/**
 * Makes a backup now, copies it to `BACKUP_COPY_DIR` if one is set, and keeps the newest `KEEP`.
 * Returns the file's name. A failed dump leaves no half-written file behind.
 */
export async function makeBackup(trigger: Trigger): Promise<string> {
	const runLog = await startRun(BACKUP_JOB, trigger);
	const c = connection();
	// Named by the clinic's clock, so a backup made at 1 a.m. here is not dated the day before.
	const now = new Date();
	const stamp = `${clinicDate(now)}-${clinicClock(now).replace(':', '')}`;
	const name = `${c.database}-${stamp}.amno`;
	const file = path.join(BACKUP_DIR, name);
	try {
		await mkdir(BACKUP_DIR, { recursive: true });
		const gzip = createGzip();
		const written = pipeline(gzip, createWriteStream(file));
		await run(
			['mariadb-dump', 'mysqldump'],
			[
				'--single-transaction',
				'--routines',
				'--triggers',
				'--no-tablespaces',
				'-h',
				c.host,
				'-P',
				c.port,
				'-u',
				c.user,
				c.database
			],
			{ output: gzip },
			c.password
		);
		await written;
		await prune(BACKUP_DIR);

		let copied = '';
		if (env.BACKUP_COPY_DIR) {
			await mkdir(env.BACKUP_COPY_DIR, { recursive: true });
			await copyFile(file, path.join(env.BACKUP_COPY_DIR, name));
			await prune(env.BACKUP_COPY_DIR);
			copied = ', and copied';
		}
		const size = (await stat(file)).size;
		await runLog.finish({ ok: true, summary: `${name} (${Math.round(size / 1024)} KB)${copied}` });
		return name;
	} catch (err: unknown) {
		await rm(file, { force: true });
		const message = err instanceof Error ? err.message : String(err);
		await runLog.finish({ ok: false, error: message });
		throw new Error(message, { cause: err });
	}
}

/**
 * Loads the newest backup into a scratch database, counts the core tables, and drops it. Returns the
 * counts. Fails when the backup will not load, or loads with a core table empty that is not empty
 * now — a backup that restores to nothing is the failure this exists to catch.
 */
export async function verifyLatest(trigger: Trigger): Promise<Record<string, number>> {
	const runLog = await startRun(VERIFY_JOB, trigger);
	const c = connection();
	const scratch = `${c.database}_restorecheck`;
	const admin = await mysql.createConnection(env.DATABASE_URL ?? '');
	try {
		const [latest] = await listBackups();
		if (!latest) throw new Error('There is no backup to verify yet.');

		await admin.query(`DROP DATABASE IF EXISTS \`${scratch}\``);
		await admin.query(`CREATE DATABASE \`${scratch}\``);
		const source = createReadStream(path.join(BACKUP_DIR, latest.name));
		await run(
			['mariadb', 'mysql'],
			['-h', c.host, '-P', c.port, '-u', c.user, scratch],
			{ input: source.pipe(createGunzip()) },
			c.password
		);

		const counts: Record<string, number> = {};
		for (const table of CORE_TABLES) {
			const [restored] = await admin.query(`SELECT COUNT(*) AS n FROM \`${scratch}\`.\`${table}\``);
			const [live] = await admin.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
			const n = Number(Array.isArray(restored) ? Reflect.get(restored[0] ?? {}, 'n') : 0);
			const now = Number(Array.isArray(live) ? Reflect.get(live[0] ?? {}, 'n') : 0);
			if (n === 0 && now > 0) throw new Error(`The backup restored with no ${table} rows.`);
			counts[table] = n;
		}
		await runLog.finish({
			ok: true,
			summary: `${latest.name} restores: ${Object.entries(counts)
				.map(([t, n]) => `${n} ${t}`)
				.join(', ')}`
		});
		return counts;
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		await runLog.finish({ ok: false, error: message });
		throw new Error(message, { cause: err });
	} finally {
		await admin.query(`DROP DATABASE IF EXISTS \`${scratch}\``).catch(() => {});
		await admin.end();
	}
}

/** The last runs of the backup and verify jobs, newest first. */
export async function backupRuns(limit = 10) {
	return db
		.select()
		.from(jobRun)
		.where(inArray(jobRun.jobName, [BACKUP_JOB, VERIFY_JOB]))
		.orderBy(desc(jobRun.startedAt))
		.limit(limit);
}

/** The last time each job worked, for the warning on the screen. */
export async function lastSuccess(jobName: string) {
	const [row] = await db
		.select({ at: jobRun.startedAt, summary: jobRun.summary })
		.from(jobRun)
		.where(and(eq(jobRun.jobName, jobName), eq(jobRun.status, 'success')))
		.orderBy(desc(jobRun.startedAt))
		.limit(1);
	return row ?? null;
}
