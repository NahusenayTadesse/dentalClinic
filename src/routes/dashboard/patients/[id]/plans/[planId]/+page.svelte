<script lang="ts">
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import MessageSquareReply from '@lucide/svelte/icons/message-square-reply';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Send from '@lucide/svelte/icons/send';
	import History from '@lucide/svelte/icons/history';
	import { Badge } from '@nahu/admin-kit/components/ui/badge/index.js';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import * as Table from '@nahu/admin-kit/components/ui/table/index.js';
	import Section from '@nahu/admin-kit/components/Section.svelte';
	import PlanStatusBadge from '$lib/components/PlanStatusBadge.svelte';
	import FormDialog from '$lib/formComponents/FormDialog.svelte';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import {
		canAddLines,
		canAdjust,
		canAnswer,
		canComplete,
		canEditLines,
		planTotals
	} from '$lib/treatmentPlanStatus';
	import { PROCEDURE_STATUS_LABEL, isProcedureStatus } from '$lib/procedureStatus';
	import ProcedurePicker from '$lib/components/ProcedurePicker.svelte';
	import StepButton from '@nahu/admin-kit/formComponents/StepButton.svelte';
	import AnswerForm from './AnswerForm.svelte';
	import PlanActions from './PlanActions.svelte';
	import {
		addWork,
		editLine,
		present,
		removeLineForm,
		type EditLine,
		type RemoveLine
	} from '../schema';

	/**
	 * One treatment plan, and whatever its next step is: a draft is checked and presented, a
	 * presented plan gets the patient's answer, an accepted one is closed once the work is done.
	 * Only the steps the plan is at are offered; the actions refuse the rest anyway.
	 *
	 * A presented quote can still be corrected while it is live, but each change asks why and is
	 * kept in the history below the lines — the quote as first given can always be read back.
	 */
	let { data } = $props();

	const plan = $derived(data.plan);
	const totals = $derived(planTotals(plan.lines));
	const draft = $derived(canEditLines(plan.status));
	const answering = $derived(canAnswer(plan.status));
	const decided = $derived(plan.decidedOn !== null);
	const adjustable = $derived(canAdjust(plan.status));
	/** Lines the viewer may change: freely on a draft, with a reason on a live quote. */
	const editable = $derived(data.canPlan && (draft || adjustable));
	const addable = $derived(data.canPlan && canAddLines(plan.status));
	/** Lines whose price or wording moved after the patient had answered — worth raising again. */
	const changedAfterAnswer = $derived(
		new Set(data.adjustments.filter((a) => a.afterAnswer).map((a) => a.itemId))
	);
	const base = $derived(`/dashboard/patients/${data.patient.id}/plans`);

	const day = (value: string | null) => (value ? formatEthiopianDate(new Date(value)) : '—');

	let addOpen = $state(false);
	let presentOpen = $state(false);
	let editOpen = $state(false);
	let editSeed = $state<Partial<EditLine>>({});

	function edit(line: (typeof plan.lines)[number]) {
		editSeed = {
			itemId: line.id,
			description: line.description,
			quantity: line.quantity,
			unitPrice: line.unitPrice,
			reason: ''
		};
		editOpen = true;
	}

	let removeOpen = $state(false);
	let removeSeed = $state<Partial<RemoveLine>>({});
	let removing = $state('');

	function remove(line: (typeof plan.lines)[number]) {
		removeSeed = { itemId: line.id, reason: '' };
		removing = line.description;
		removeOpen = true;
	}

	/** The words for each field of an adjustment's `changes`. */
	const FIELD: Record<string, string> = {
		description: 'Wording',
		quantity: 'Quantity',
		unitPrice: 'Price',
		lineTotal: 'Total'
	};

	/** One adjustment's changes as a reader says them: "Price 2,000.00 → 1,750.00". */
	function describe(changes: Record<string, [unknown, unknown]>): string[] {
		return Object.entries(changes)
			.filter(([field]) => field !== 'lineTotal' && field in FIELD)
			.map(([field, [was, now]]) => {
				const show = (v: unknown) =>
					field === 'unitPrice' ? formatETB(Number(v)) : v === null ? '—' : String(v);
				return `${FIELD[field]}: ${show(was)} → ${show(now)}`;
			});
	}

	const KIND = { changed: 'Changed', added: 'Added', removed: 'Removed' } as const;
</script>

<svelte:head>
	<title>{data.patient.fullName} — Treatment plan</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PlanActions
		{base}
		planId={plan.id}
		patientId={data.patient.id}
		{draft}
		{addable}
		canPlan={data.canPlan}
		canBook={data.can.book}
		toBook={data.toBook}
		completable={canComplete(plan.status, data.progress.done, data.progress.total)}
		confirm={data.forms.confirm}
		onadd={() => (addOpen = true)}
	/>

	<Section title="Treatment plan" IconComp={ClipboardList} style="identityIcon">
		{#snippet editDialog()}
			<div class="ml-auto"><PlanStatusBadge status={plan.status} /></div>
		{/snippet}

		<dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
			<div>
				<dt class="text-muted-foreground">Proposed by</dt>
				<dd>{plan.provider ?? '—'}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Presented</dt>
				<dd>{day(plan.presentedOn)}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Quote stands until</dt>
				<dd>{day(plan.validUntil)}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Answered</dt>
				<dd>{day(plan.decidedOn)}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground">Quoted{data.adjustments.length ? ' now' : ''}</dt>
				<dd class="font-semibold tabular-nums">{formatETB(totals.quoted)}</dd>
			</div>
			{#if data.adjustments.length}
				<div>
					<dt class="text-muted-foreground">First quoted</dt>
					<dd class="tabular-nums">{formatETB(data.originalTotal)}</dd>
				</div>
			{/if}
			{#if decided}
				<div>
					<dt class="text-muted-foreground">Agreed</dt>
					<dd class="font-semibold tabular-nums">{formatETB(totals.accepted)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Declined</dt>
					<dd class="tabular-nums">{formatETB(totals.declined)}</dd>
				</div>
			{/if}
			{#if data.progress.total}
				<div>
					<dt class="text-muted-foreground">Agreed work done</dt>
					<dd>{data.progress.done} of {data.progress.total}</dd>
				</div>
			{/if}
		</dl>

		<!-- Shown only while some of the plan is a no; after a line comes off it may be all yes. -->
		{#if plan.declineReason && (plan.status === 'partial' || plan.status === 'declined')}
			<p class="mt-4 rounded-md border p-3 text-sm">
				<span class="text-muted-foreground">Why not:</span>
				{plan.declineReason}
			</p>
		{/if}
		{#if plan.note}
			<p class="mt-4 text-sm text-muted-foreground">{plan.note}</p>
		{/if}
		{#if plan.status === 'expired'}
			<p class="mt-4 rounded-md border border-amber-500 p-3 text-sm">
				This quote expired without an answer. Its work is free to go on a new plan, at today’s
				prices.
			</p>
		{/if}
		{#if draft}
			<p class="mt-4 text-sm text-muted-foreground">
				A draft has not been shown to the patient, so change wording and prices freely. Once it is
				presented, every change asks why and is kept in the quote’s history.
			</p>
		{/if}
	</Section>

	<Section title="Lines" IconComp={ClipboardList} style="systemIcon">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Treatment</Table.Head>
					<Table.Head class="text-right">Qty</Table.Head>
					<Table.Head class="text-right">Price</Table.Head>
					<Table.Head class="text-right">Total</Table.Head>
					{#if decided}<Table.Head>Answer</Table.Head>{/if}
					<Table.Head>On the chart</Table.Head>
					{#if editable}<Table.Head class="sr-only">Change</Table.Head>{/if}
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each plan.lines as line (line.id)}
					<Table.Row>
						<Table.Cell>
							{line.description}
							{#if changedAfterAnswer.has(line.id)}
								<Badge variant="outline" class="ml-2 border-amber-500"
									>Changed after it was agreed</Badge
								>
							{/if}
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{line.quantity}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatETB(line.unitPrice)}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{formatETB(line.lineTotal)}</Table.Cell>
						{#if decided}
							<Table.Cell>
								{#if line.decision === 'accepted'}
									<Badge>Yes</Badge>
								{:else if line.decision === 'declined'}
									<Badge variant="outline">No</Badge>
								{:else}—{/if}
							</Table.Cell>
						{/if}
						<Table.Cell class="text-muted-foreground">
							{line.procedureStatus && isProcedureStatus(line.procedureStatus)
								? PROCEDURE_STATUS_LABEL[line.procedureStatus].label
								: 'No longer charted'}
						</Table.Cell>
						{#if editable}
							<Table.Cell class="flex justify-end gap-1">
								<Button
									size="icon"
									variant="ghost"
									aria-label="Change {line.description}"
									onclick={() => edit(line)}
								>
									<Pencil class="size-4" />
								</Button>
								{#if draft}
									<StepButton
										id="remove-line-{line.id}"
										action="?/removeLine"
										data={data.forms.remove}
										label="Remove"
										variant="ghost"
										values={{ itemId: line.id }}
									/>
								{:else}
									<Button
										size="sm"
										variant="ghost"
										aria-label="Remove {line.description}"
										onclick={() => remove(line)}
									>
										Remove
									</Button>
								{/if}
							</Table.Cell>
						{/if}
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={6} class="text-muted-foreground">
							No lines. Add planned work to quote.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>

		{#if draft && data.canPlan && plan.lines.length}
			<div class="mt-4 flex justify-end">
				<Button onclick={() => (presentOpen = true)}>
					<Send class="size-4" /> Present to patient
				</Button>
			</div>
		{/if}
	</Section>

	{#if data.adjustments.length}
		<Section title="Changes since it was presented" IconComp={History} style="systemIcon">
			<p class="mb-3 text-sm text-muted-foreground">
				Kept for good: a change to a presented quote is never edited or removed. The quote was first {formatETB(
					data.originalTotal
				)}.
			</p>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>When</Table.Head>
						<Table.Head>Line</Table.Head>
						<Table.Head>What</Table.Head>
						<Table.Head class="text-right">Effect</Table.Head>
						<Table.Head>Why</Table.Head>
						<Table.Head>By</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.adjustments as change (change.id)}
						{@const effect = change.lineTotalAfter - change.lineTotalBefore}
						<Table.Row>
							<Table.Cell class="whitespace-nowrap">
								{formatEthiopianDate(new Date(change.createdAt))}
							</Table.Cell>
							<Table.Cell>{change.line}</Table.Cell>
							<Table.Cell>
								<span class="font-medium">{KIND[change.kind]}</span>
								{#if change.afterAnswer}
									<Badge variant="outline" class="ml-1 border-amber-500">after the answer</Badge>
								{/if}
								{#each describe(change.changes) as said (said)}
									<div class="text-muted-foreground">{said}</div>
								{/each}
							</Table.Cell>
							<Table.Cell class="text-right whitespace-nowrap tabular-nums">
								{effect > 0 ? '+' : ''}{formatETB(effect)}
							</Table.Cell>
							<Table.Cell>{change.reason}</Table.Cell>
							<Table.Cell>{change.by ?? '—'}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Section>
	{/if}

	{#if answering && data.canPlan}
		<Section title="The patient’s answer" IconComp={MessageSquareReply} style="personalIcon">
			<AnswerForm data={data.forms.answer} lines={plan.lines} />
		</Section>
	{:else if answering}
		<p class="text-sm text-muted-foreground">
			<Send class="inline size-4" /> Awaiting the patient’s answer.
		</p>
	{/if}
</div>

<FormDialog
	title="Add planned work"
	action="?/addWork"
	data={data.forms.add}
	schema={addWork}
	bind:open={addOpen}
	hideTrigger
	resetOnSuccess
	submitLabel="Add to plan"
	disabled={!addable}
>
	{#snippet fields({ form, errors })}
		<ProcedurePicker {form} work={data.plannable} legend="Planned work to quote">
			{#snippet empty()}
				No planned work is free to quote. Chart the treatment as <em>planned</em> on the dental chart
				first; work already on an open plan is not listed.
			{/snippet}
		</ProcedurePicker>
		{#if !draft}
			<InputComp
				label="Why is it being added?"
				name="reason"
				{form}
				{errors}
				required
				placeholder="The X-ray showed a second tooth needs treatment"
			/>
		{/if}
	{/snippet}
</FormDialog>

<FormDialog
	title="Change line"
	action="?/editLine"
	data={data.forms.edit}
	schema={editLine}
	bind:open={editOpen}
	seed={editSeed}
	hideTrigger
	disabled={!editable}
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="itemId" value={values.itemId} />
		{#if !draft}
			<p class="text-sm text-muted-foreground">
				This quote has been presented. The change is kept in its history with the reason, and the
				quote as first given can always be read back.
			</p>
		{/if}
		<InputComp label="What the patient reads" name="description" {form} {errors} />
		<InputComp label="Quantity" name="quantity" type="number" step="1" min="1" {form} {errors} />
		<InputComp
			label="Price each (birr)"
			name="unitPrice"
			type="number"
			step="0.01"
			min="0"
			{form}
			{errors}
		/>
		{#if !draft}
			<InputComp
				label="Why is it changing?"
				name="reason"
				{form}
				{errors}
				required
				placeholder="Discount agreed · X-ray showed it needs a crown · quoted twice"
			/>
		{/if}
	{/snippet}
</FormDialog>

<FormDialog
	title="Remove line"
	description="Take “{removing}” off this quote. The line and why it went are kept in the quote’s history; the work stays planned on the chart."
	action="?/removeLine"
	data={data.forms.remove}
	schema={removeLineForm}
	bind:open={removeOpen}
	seed={removeSeed}
	hideTrigger
	submitLabel="Remove it"
	disabled={!editable || draft}
>
	{#snippet fields({ form, errors, values })}
		<input type="hidden" name="itemId" value={values.itemId} />
		<InputComp
			label="Why is it coming off?"
			name="reason"
			{form}
			{errors}
			required
			placeholder="Patient already had it done elsewhere · quoted twice"
		/>
	{/snippet}
</FormDialog>

<FormDialog
	title="Present this plan"
	description="Mark it as shown to the patient. From then on the plan waits for their answer, and any change to the lines asks why and is kept."
	action="?/present"
	data={data.forms.present}
	schema={present}
	bind:open={presentOpen}
	hideTrigger
	submitLabel="Present"
	disabled={!data.canPlan || !draft}
>
	{#snippet fields({ form, errors })}
		<InputComp
			label="Quote stands until"
			name="validUntil"
			type="date"
			oldDays={false}
			{form}
			{errors}
			description="After this date it reads as expired, and a new plan quotes today’s prices."
		/>
	{/snippet}
</FormDialog>
