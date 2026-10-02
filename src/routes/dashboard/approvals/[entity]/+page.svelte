<script lang="ts">
	import { makeColumns } from '$lib/components/approvals/columns';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { BadgeCheck, X, Frown, ArrowBigLeft, ArrowRight } from '@lucide/svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { settleSchema } from '../schema';
	import DialogComp from '@nahu/admin-kit/formComponents/DialogComp.svelte';
	import { fly } from 'svelte/transition';

	let { data } = $props();

	let selected = $state<{ id: number }[]>([]);

	// The registry decides which fields a queue shows and which of them name another
	// record, so the columns are built from the shape of the first row plus that
	// declaration rather than being written out per entity.
	let columns = $derived(makeColumns(data.rows[0], data.entity.links));

	// The reject dialog is the prompt for a reason: rejecting is a decision the requester has
	// to act on, so it cannot be a single click the way approving is.
	let rejectOpen = $state(false);

	// `createForm` wires the validator and the toast every form shares (CLAUDE.md §13).
	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, settleSchema, {
		dataType: 'json',
		onResult: ({ result }) => {
			// A failure means the form came back for correction — keep the selection and the
			// dialog so the reason can be filled in rather than re-picked from the table.
			if (result.type === 'failure') return;
			rejectOpen = false;
			selected = [];
			$form.reason = '';
		}
	});

	$effect(() => {
		$form.ids = selected.map((r) => r.id);
	});

	function submitWith(decision: 'approved' | 'rejected') {
		$form.decision = decision;
	}
</script>

<svelte:head>
	<title>Unapproved {data.entity.label}</title>
</svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-2">
	<Button href="/dashboard/approvals" variant="outline"><ArrowBigLeft /> All queues</Button>
	{#if data.entity.listHref}
		<Button href={data.entity.listHref} variant="outline">
			Approved {data.entity.label.toLowerCase()}
			<ArrowRight />
		</Button>
	{/if}
</div>

{#if data.rows.length === 0}
	<div class="flex h-96 w-full flex-col items-center justify-center">
		<p class="mt-4 flex flex-row gap-4 text-center text-3xl">
			<Frown class="h-10 w-14 animate-bounce" />
			Nothing waiting for approval
		</p>
		<p class="mt-2 text-sm text-muted-foreground">
			Every {data.entity.label.toLowerCase()} record has been approved or rejected.
		</p>
	</div>
{:else}
	<div
		class="mx-auto my-4 max-w-4xl gap-4 rounded-lg bg-white/80 p-4 shadow-sm backdrop-blur-sm lg:flex lg:items-center lg:justify-between dark:bg-gray-800/80"
	>
		<div class="flex-1">
			<h2 class="text-lg font-semibold text-gray-900 lg:text-2xl dark:text-gray-100">
				{data.entity.label} awaiting approval:
				<span class="font-medium">{data.rows.length}</span>
			</h2>
			<p class="mt-1 text-sm text-muted-foreground">
				You cannot release a record you requested yourself unless you hold the override permission.
			</p>
		</div>
	</div>

	{#if selected.length > 0}
		<div transition:fly={{ x: -200, duration: 600 }}>
			<FormCard title="Approve or reject selected" className="relative!">
				<p class="my-4 text-sm">Selected: {selected.length}</p>
				<Button
					title="Unselect all"
					variant="outline"
					class="absolute top-2 right-2"
					size="icon"
					onclick={() => (selected = [])}><X /></Button
				>

				<form
					id="settle"
					action="?/settle"
					method="post"
					use:enhance
					class="my-4 flex flex-col gap-4"
				>
					<Errors allErrors={$allErrors} />

					<div class="flex flex-wrap gap-3">
						<Button type="submit" onclick={() => submitWith('approved')}>
							{#if $delayed}
								<LoadingBtn name="Working" />
							{:else}
								<BadgeCheck /> Approve {selected.length}
							{/if}
						</Button>

						<DialogComp
							bind:open={rejectOpen}
							variant="destructive"
							title="Reject {selected.length} {selected.length === 1
								? data.entity.singular
								: data.entity.label.toLowerCase()}"
							description="The reason is stored on the record and is what the requester sees."
							IconComp={X}
						>
							{#snippet trigger(props)}
								<Button type="button" variant="destructive" {...props}>
									<X /> Reject {selected.length}
								</Button>
							{/snippet}

							<div class="flex flex-col gap-4 p-1">
								<InputComp
									{form}
									{errors}
									label="Reason for rejection"
									type="textarea"
									name="reason"
									rows={5}
									required
									placeholder="Tell the requester what to change"
								/>

								<Button
									type="submit"
									form="settle"
									variant="destructive"
									class="w-full"
									onclick={() => submitWith('rejected')}
								>
									{#if $delayed}
										<LoadingBtn name="Rejecting" />
									{:else}
										<X /> Reject {selected.length}
									{/if}
								</Button>
							</div>
						</DialogComp>
					</div>
				</form>
			</FormCard>
		</div>
	{/if}

	{#key data.rows}
		<DataTable
			data={data.rows}
			{columns}
			fileName="Unapproved {data.entity.label}"
			bind:selected
			facetKeys={['requestedByName']}
			facetLabels={{ requestedByName: 'Requested by' }}
		/>
	{/key}
{/if}
