// src/routes/download-bundle/+server.js

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
// import { glob } from 'glob';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { backup } from '$lib/server/db/schema';

export async function GET() {
	const filesDir = env.FILES_DIR;
	const backupDir = path.join(process.cwd(), 'backups');

	if (!filesDir || !fs.existsSync(filesDir)) {
		error(500, 'FILES_DIR is not set or does not exist');
	}

	/*
	 * --- Find the latest backup ---
	 * `.amno` since the rebrand. `.pulsedata` is still read: backups already written under the old
	 * name must stay downloadable, and whatever writes them may not have been updated yet.
	 */
	const backupFiles = fs
		.readdirSync(backupDir)
		.filter((f) => f.endsWith('.amno') || f.endsWith('.pulsedata'))
		.map((f) => path.join(backupDir, f));

	if (backupFiles.length === 0) {
		error(404, 'No backup files found');
	}

	const latestBackup = backupFiles
		.map((f) => ({ file: f, mtime: fs.statSync(f).mtimeMs }))
		.sort((a, b) => b.mtime - a.mtime)[0].file;

	// --- Stream tar.gz directly to client via system tar ---
	const tar = spawn('tar', [
		'-czf',
		'-', // -c create, -z gzip, -f - (stdout)
		'-C',
		path.dirname(filesDir), // change into parent of FILES_DIR
		path.basename(filesDir), // add the FILES_DIR folder
		'-C',
		path.dirname(latestBackup), // change into backup folder
		path.basename(latestBackup) // add the latest backup file
	]);

	const fileName = `bundle_${new Date().toISOString().slice(0, 10)}.tar.gz`;

	const webStream = new ReadableStream({
		start(controller) {
			tar.stdout.on('data', (chunk) => controller.enqueue(chunk));
			tar.stdout.on('end', () => controller.close());
			tar.stderr.on('data', (err) => console.error('tar error:', err.toString()));
			tar.on('error', (err) => controller.error(err));
		}
	});

	const exists = await db.select().from(backup).limit(1);

	if (exists.length) {
		await db.update(backup).set({ lastDownload: new Date() });
	} else {
		await db.insert(backup).values({ lastDownload: new Date() });
	}

	return new Response(webStream, {
		headers: {
			'Content-Type': 'application/gzip',
			'Content-Disposition': `attachment; filename="${fileName}"`
		}
	});
}
