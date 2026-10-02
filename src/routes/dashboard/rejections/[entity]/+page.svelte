<script lang="ts">
	import { makeColumns } from '$lib/components/approvals/columns';
	import DataTable from '@nahu/admin-kit/components/Table/data-table.svelte';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { Undo2, X, PartyPopper, ArrowBigLeft, ArrowRight } from '@lucide/svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { reopenSchema } from '../schema';
	import { fly } from 'svelte/transition';

	let { data } = $props();

	let selected = $state<{ id: number }[]>([]);

	// Same registry-built columns as the approval queues, plus the three the rejection
	// itself carries: why, by whom, and when.
	let columns = $derived(makeColumns(data.rows[0], data.entity.links, true));

	// `createForm` wires the validator and the toast every form shares (CLAUDE.md §13).
	// svelte-ignore state_referenced_locally
	const { form, enhance, delayed, allErrors } = createForm(data.form, reopenSchema, {
		dataType: 'json',
		onResult: ({ result }) => {
			if (result.type === 'failure') return;
			selected = [];
		}
	});

	$effect(() => {
		$form.ids = selected.map((r) => r.id);
	});
</script>

<svelte:head>
	<title>Rejected {data.entity.label}</title>
</svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-2">
	<Button href="/dashboard/rejections" variant="outline"><ArrowBigLeft /> All rejections</Button>
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
			<PartyPopper class="h-10 w-14 animate-bounce" />
			Nothing rejected
		</p>
		<p class="mt-2 text-sm text-muted-foreground">
			Every {data.entity.label.toLowerCase()} record is either approved or still waiting.
		</p>
	</div>
{:else}
	<div
		class="mx-auto my-4 max-w-4xl gap-4 rounded-lg bg-white/80 p-4 shadow-sm backdrop-blur-sm lg:flex lg:items-center lg:justify-between dark:bg-gray-800/80"
	>
		<div class="flex-1">
			<h2 class="text-lg font-semibold text-gray-900 lg:text-2xl dark:text-gray-100">
				{data.entity.label} rejected:
				<span class="font-medium">{data.rows.length}</span>
			</h2>
			<p class="mt-1 text-sm text-muted-foreground">
				Sending a record back puts it in front of an approver again and clears its rejection reason.
			</p>
		</div>
	</div>

	{#if selected.length > 0}
		<div transition:fly={{ x: -200, duration: 600 }}>
			<FormCard title="Send back for approval" className="relative!">
				<p class="my-4 text-sm">Selected: {selected.length}</p>
				<Button
					title="Unselect all"
					variant="outline"
					class="absolute top-2 right-2"
					size="icon"
					onclick={() => (selected = [])}><X /></Button
				>

				<form action="?/reopen" method="post" use:enhance class="my-4 flex flex-col gap-4">
					<Errors allErrors={$allErrors} />

					<div class="flex flex-wrap gap-3">
						<Button type="submit">
							{#if $delayed}
								<LoadingBtn name="Reopening" />
							{:else}
								<Undo2 /> Send {selected.length} back for approval
							{/if}
						</Button>
					</div>
				</form>
			</FormCard>
		</div>
	{/if}

	{#key data.rows}
		<DataTable
			data={data.rows}
			{columns}
			fileName="Rejected {data.entity.label}"
			bind:selected
			facetKeys={['requestedByName', 'rejectedByName']}
			facetLabels={{ requestedByName: 'Requested by', rejectedByName: 'Rejected by' }}
		/>
	{/key}
{/if}
