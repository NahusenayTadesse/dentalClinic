<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import DatabaseBackup from '@lucide/svelte/icons/database-backup';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Download from '@lucide/svelte/icons/download';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import History from '@lucide/svelte/icons/history';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import { clinicClock } from '$lib/clinicTime';

	/**
	 * Backups: the files on this server, when the backup and the restore check last worked, and the
	 * buttons to run either now. A warning when the newest backup is older than it should be.
	 */
	let { data } = $props();

	let running = $state<'backup' | 'verify' | null>(null);
	const busy =
		(which: 'backup' | 'verify'): SubmitFunction =>
		() => {
			running = which;
			return async ({ update }) => {
				await update({ reset: false });
				running = null;
			};
		};

	const when = (at: Date | string | null) =>
		at ? `${formatEthiopianDate(new Date(at))} ${clinicClock(at)}` : 'Never';
	const size = (bytes: number) =>
		bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
</script>

<svelte:head>
	<title>Backups</title>
</svelte:head>

<div class="mx-auto flex max-w-305 flex-col gap-6 p-4 md:p-8">
	<header class="flex flex-col gap-1">
		<h1 class="text-3xl font-extrabold tracking-tight">Backups</h1>
		<p class="text-muted-foreground">
			A copy of the whole database, made every night and kept for {data.keep} days, and a check that the
			newest one actually restores.
		</p>
	</header>

	{#if data.stale}
		<p
			class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
			role="alert"
		>
			<TriangleAlert class="mt-0.5 size-4 shrink-0 text-destructive" />
			<span>
				{data.files.length
					? `The newest backup is more than ${data.staleDays} days old.`
					: 'There is no backup on this server yet.'}
				{data.cronConfigured
					? 'Check that the nightly cron job is still running.'
					: 'Set BACKUP_CRON_SECRET and add the nightly cron job (see Help), or back up now.'}
			</span>
		</p>
	{/if}

	<Section title="Now" IconComp={DatabaseBackup} style="identityIcon">
		<dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
			<div>
				<dt class="text-muted-foreground">Last backup</dt>
				<dd>{when(data.lastBackup?.at ?? null)}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Last checked to restore</dt>
				<dd>{when(data.lastVerify?.at ?? null)}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Copy off this server</dt>
				<dd>
					{data.copyConfigured
						? 'Each backup is also copied to BACKUP_COPY_DIR'
						: 'Not set up — a dead disk would take the backups with it'}
				</dd>
			</div>
		</dl>
		<div class="mt-4 flex flex-wrap gap-2">
			{#if data.canRun}
				<form method="post" action="?/backup" use:enhance={busy('backup')}>
					<Button type="submit" disabled={running !== null}>
						{#if running === 'backup'}<LoadingBtn name="Backing up" />{:else}<DatabaseBackup
								class="size-4"
							/> Back up now{/if}
					</Button>
				</form>
				<form method="post" action="?/verify" use:enhance={busy('verify')}>
					<Button
						type="submit"
						variant="outline"
						disabled={running !== null || data.files.length === 0}
					>
						{#if running === 'verify'}<LoadingBtn name="Checking" />{:else}<ShieldCheck
								class="size-4"
							/> Check the newest restores{/if}
					</Button>
				</form>
			{/if}
			{#if data.files.length}
				<Button variant="outline" href="/dashboard/backup">
					<Download class="size-4" /> Download the newest, with uploaded files
				</Button>
			{/if}
		</div>
	</Section>

	<Section title="On this server" IconComp={History} style="identityIcon">
		{#if data.files.length}
			<ul class="flex flex-col divide-y rounded-md border text-sm">
				{#each data.files as file (file.name)}
					<li class="flex flex-wrap justify-between gap-2 px-3 py-2">
						<span class="font-mono">{file.name}</span>
						<span class="text-muted-foreground">{when(file.at)} · {size(file.size)}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">No backups yet.</p>
		{/if}
	</Section>

	<Section title="Recent runs" IconComp={History} style="identityIcon">
		{#if data.runs.length}
			<ul class="flex flex-col divide-y rounded-md border text-sm">
				{#each data.runs as run (run.id)}
					<li class="flex flex-col gap-0.5 px-3 py-2">
						<span>
							<strong>{run.jobName === 'backup' ? 'Backup' : 'Restore check'}</strong>
							· {run.trigger} · {when(run.startedAt)} ·
							<span class={run.status === 'failed' ? 'text-destructive' : ''}>{run.status}</span>
						</span>
						<span class="text-muted-foreground">{run.summary ?? run.error ?? ''}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-muted-foreground">Nothing has run yet.</p>
		{/if}
	</Section>
</div>
