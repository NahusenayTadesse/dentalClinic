<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import { createForm } from '@nahu/admin-kit/forms/createForm.js';
	import { supplier } from '$lib/forms/supplier';
	import SupplierFields from '../SupplierFields.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, delayed, allErrors } = createForm(data.form, supplier);
</script>

<svelte:head>
	<title>Add Supplier</title>
</svelte:head>

<FormCard title="Add a supplier">
	<form action="?/add" use:enhance id="main" class="flex flex-col gap-4" method="post">
		<Errors allErrors={$allErrors} />
		<SupplierFields {form} {errors} subcities={data.subcitiesList} />
		<Button type="submit" form="main">
			{#if $delayed}
				<LoadingBtn name="Adding supplier" />
			{:else}
				<Plus class="size-4" /> Add supplier
			{/if}
		</Button>
	</form>
</FormCard>
