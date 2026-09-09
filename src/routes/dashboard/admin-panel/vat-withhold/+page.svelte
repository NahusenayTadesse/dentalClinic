<script>
	import DialogComp from '$lib/formComponents/DialogComp.svelte';
	import { Button } from '$lib/components/ui/button/index';

	let { data } = $props();
	import { superForm } from 'sveltekit-superforms/client';
	import InputComp from '$lib/formComponents/InputComp.svelte';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import { Save, SquarePen } from '@lucide/svelte';

	const { form, errors, enhance, delayed, message } = superForm(data.form, {});

	import { toast } from 'svelte-sonner';
	import { formatETB, formatEthiopianDate } from '$lib/global.svelte';
	import FormCard from '$lib/formComponents/FormCard.svelte';
	$effect(() => {
		if ($message) {
			if ($message.type === 'error') {
				toast.error($message.text);
			} else {
				toast.success($message.text);
			}
		}
	});
</script>

<svelte:head>
	<title>Vat and Withhold</title>
</svelte:head>
{#key data.allData}
	<FormCard title="Change Vat or Withhold" class="mx-auto mt-10 max-w-md">
		<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 bg-slate-50 px-6 py-4">
				<h3 class="text-lg font-semibold text-slate-800">Tax Configurations</h3>
				<p class="text-sm text-slate-500">
					Current active rates as of {formatEthiopianDate(new Date())}
				</p>
			</div>

			<div class="space-y-6 p-6">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<p class="text-sm font-medium tracking-wider text-slate-600 uppercase">VAT Rate</p>
						<p class="text-xs text-slate-400">Value Added Tax applied to sales</p>
					</div>
					<div class="flex items-baseline">
						<span class="text-3xl font-bold text-indigo-600">{data?.allData?.vat}</span>
						<span class="ml-1 text-lg font-medium text-indigo-400">%</span>
					</div>
				</div>

				<div class="h-px bg-linear-to-r from-transparent via-slate-200 to-transparent"></div>

				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<p class="text-sm font-medium tracking-wider text-slate-600 uppercase">Withholding</p>
						<p class="text-xs text-slate-400">Tax withheld at source</p>
					</div>
					<div class="flex items-baseline">
						<span class="text-3xl font-bold text-emerald-600">{data?.allData?.withHold} </span>
						<span class="ml-1 text-lg font-medium text-emerald-400">%</span>
					</div>
				</div>
			</div>

			<div class="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
				<DialogComp title="Change Vat or Withhold" variant="default" IconComp={SquarePen}>
					<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
						<InputComp
							{form}
							{errors}
							label="vat"
							type="number"
							name="vat"
							placeholder="Enter vat amount"
							required={true}
						/>
						<InputComp
							{form}
							{errors}
							label="Withhold"
							type="number"
							name="withHold"
							placeholder="Enter withhold amount"
							required={true}
						/>

						<Button type="submit" form="main">
							{#if $delayed}
								<LoadingBtn name="Saving Changes" />
							{:else}
								<Save /> Save Changes
							{/if}
						</Button>
					</form>
				</DialogComp>
			</div>
		</div>

		<p class="mt-4 text-center text-xs text-slate-400">
			Note: Updating these values will not overwrite existing records.
		</p>
	</FormCard>
{/key}
