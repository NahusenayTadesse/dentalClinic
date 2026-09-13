import {
	superForm,
	type FormOptions,
	type SuperForm,
	type SuperValidated
} from 'sveltekit-superforms';
import { zod4Client } from 'sveltekit-superforms/adapters';
import { toast } from 'svelte-sonner';

/**
 * `superForm`, with the validator and the toast already wired.
 *
 * **Why this exists.** Eighty-seven of the eighty-eight form pages in this app hand-rolled the
 * same toast, and they did it with an `$effect` watching `$message`:
 *
 *     $effect(() => {
 *       if ($message) {
 *         if ($message.type === 'error') toast.error($message.text);
 *         else toast.success($message.text);
 *       }
 *     });
 *
 * That is the wrong tool twice over. An effect fires whenever anything it reads changes, so it is
 * tied to the *store* rather than to the submission that set it — superforms already hands the
 * result to `onUpdated`, which runs once per completed submit and carries the validated form with
 * it. And eighty-seven copies of a two-branch conditional is eighty-seven chances for one of them
 * to disagree; one already does, in `add-employee`, where the same check is nested inside itself
 * and a commented-out `$effect` sits underneath doing the job again.
 *
 * **A function rather than a component**, because `superForm` returns stores the caller binds to
 * — `$form[name]`, `$errors`, `enhance`. A component could only hand those back through a
 * snippet, which is more ceremony than it removes.
 *
 *     const { form, errors, enhance, delayed } = createForm(data.form, addPatient);
 *
 * Everything `superForm` accepts still passes through, and anything given here wins — including
 * `onUpdated`, which is *composed* rather than replaced, so a page can do its own thing on
 * success and still get the toast.
 */
/**
 * The shape every form's message has. Forms may add to it — `add-employee` attaches the id of the
 * duplicate it found so the toast can link there — which is why `createForm` is generic over the
 * message rather than pinning it to this.
 */
export type FormMessage = { type: 'success' | 'error'; text: string };

/** Shows one superforms message. Exported for the few places that post a message by hand. */
export function showFormMessage(message: FormMessage | undefined | null) {
	if (!message?.text) return;

	if (message.type === 'error') toast.error(message.text);
	else toast.success(message.text);
}

/**
 * Whatever `zod4Client` itself accepts — taken from the adapter rather than restated, so a zod
 * upgrade cannot leave this signature quietly describing the wrong thing.
 */
type FormSchema = Parameters<typeof zod4Client>[0];

export function createForm<T extends Record<string, unknown>, M extends FormMessage = FormMessage>(
	data: SuperValidated<T, M>,
	/**
	 * The schema the form posts to. `undefined` only for a generic component handed a form
	 * without its schema — `LookupEdit` on a lookup screen that has not passed one yet. That form
	 * is still validated, on the server, which is the validation that counts; it just waits for
	 * the round trip to say so.
	 */
	schema: FormSchema | undefined,
	options: FormOptions<T, M> = {}
): SuperForm<T, M> {
	const { onUpdated, ...rest } = options;

	return superForm<T, M>(data, {
		/*
		 * The adapter is generic over the schema and `superForm` over the form's own shape; the
		 * two are the same type in practice — the schema is what produced `data` — but nothing in
		 * the signature says so, and there is no way to tell TypeScript that from here without
		 * requiring every caller to restate its type. One cast, named and explained (CLAUDE.md §3).
		 */
		validators: schema ? (zod4Client(schema) as FormOptions<T, M>['validators']) : undefined,

		...rest,

		onUpdated(event) {
			// The toast first, so a caller that navigates away in its own handler still shows it.
			showFormMessage(event.form.message);
			onUpdated?.(event);
		}
	});
}

/**
 * The "you have unsaved changes" prompt, for forms long enough that losing one matters.
 *
 * Not on by default: on a two-field dialog it is an interruption rather than a safeguard, and a
 * prompt people learn to dismiss protects nothing.
 *
 *     createForm(data.form, schema, { taintedMessage: confirmLeave })
 */
export const confirmLeave = () =>
	new Promise<boolean>((resolve) => {
		resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
	});
