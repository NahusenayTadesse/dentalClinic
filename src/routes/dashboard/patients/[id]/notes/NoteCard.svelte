<script lang="ts">
	import FilePen from '@lucide/svelte/icons/file-pen';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Signature from '@lucide/svelte/icons/signature';
	import Trash from '@lucide/svelte/icons/trash-2';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import StepButton from '$lib/formComponents/StepButton.svelte';
	import { clinicDate, ethiopianClock } from '$lib/clinicTime';
	import { formatEthiopianDate } from '$lib/global.svelte';
	import type { NoteEntry } from '$lib/server/clinicalNotes';

	/**
	 * One clinical note: what kind, who wrote it and when, the visit it describes, and the text. A
	 * draft says so and, for its author, offers edit, sign and discard; a signed note offers only an
	 * amendment. An amendment is drawn with the same card, beneath the note it corrects.
	 */
	let {
		note,
		me,
		canWrite,
		step,
		amendment = false,
		onedit,
		onamend
	}: {
		note: Omit<NoteEntry, 'amendments'>;
		/** The signed-in user, whose drafts are theirs to change. */
		me: string | null;
		canWrite: boolean;
		step: SuperValidated<Record<string, unknown>>;
		amendment?: boolean;
		onedit: () => void;
		onamend: () => void;
	} = $props();

	const KIND = {
		examination: 'Examination',
		treatment: 'Treatment',
		telephone: 'Telephone',
		note: 'Note'
	} as const;

	const when = (instant: Date | string) =>
		`${formatEthiopianDate(new Date(clinicDate(instant)))} ${ethiopianClock(instant)}`;
	const ownDraft = $derived(!note.signedAt && note.authorId === me && canWrite);
</script>

<article class="flex flex-col gap-2 rounded-lg border bg-card p-4 {amendment ? 'ml-6' : ''}">
	<header class="flex flex-wrap items-center gap-2 text-sm">
		{#if amendment}
			<Badge variant="outline">Amendment</Badge>
		{:else}
			<Badge variant="secondary">{KIND[note.kind]}</Badge>
		{/if}
		{#if !note.signedAt}<Badge variant="outline" class="border-amber-500">Draft</Badge>{/if}
		{#if note.summary}<span class="font-semibold">{note.summary}</span>{/if}
		<span class="ml-auto text-muted-foreground">{when(note.createdAt)}</span>
	</header>

	<p class="text-sm whitespace-pre-wrap">{note.body}</p>

	<footer class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
		<span>Written by {note.author ?? 'someone no longer on the system'}</span>
		{#if note.provider}<span>· Clinician {note.provider}</span>{/if}
		{#if note.visitAt}<span>· Visit of {when(note.visitAt)}</span>{/if}
		{#if note.signedAt}<span>· Signed {when(note.signedAt)}</span>{/if}

		<span class="ml-auto flex gap-2">
			{#if ownDraft}
				<Button variant="ghost" size="sm" onclick={onedit}><FilePen class="size-4" /> Edit</Button>
				<StepButton
					id="sign-note-{note.id}"
					action="?/sign"
					data={step}
					label="Sign"
					icon={Signature}
					values={{ noteId: note.id }}
					confirm={{
						title: 'Sign this note?',
						description:
							'A signed note is part of the record for good. It can be corrected by adding an amendment, but not changed.',
						action: 'Sign'
					}}
				/>
				<StepButton
					id="discard-note-{note.id}"
					action="?/discard"
					data={step}
					label="Discard"
					icon={Trash}
					variant="ghost"
					values={{ noteId: note.id }}
					confirm={{
						title: 'Throw this draft away?',
						description: 'It was never signed, so nothing is lost but the draft.',
						action: 'Discard'
					}}
				/>
			{:else if note.signedAt && canWrite && !amendment}
				<Button variant="ghost" size="sm" onclick={onamend}><PenLine class="size-4" /> Amend</Button
				>
			{/if}
		</span>
	</footer>
</article>
