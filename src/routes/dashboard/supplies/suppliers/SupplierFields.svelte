<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import InputComp from '@nahu/admin-kit/formComponents/InputComp.svelte';

	/** A supplier's fields — shared by the add page and the detail page's edit dialog. */
	let {
		form,
		errors,
		subcities
	}: {
		form: ComponentProps<typeof InputComp>['form'];
		errors: ComponentProps<typeof InputComp>['errors'];
		subcities: { value: number; name: string | null }[];
	} = $props();

	// A subcity with no name still has to be choosable, so it reads as blank rather than failing.
	const items = $derived(subcities.map((s) => ({ value: s.value, name: s.name ?? '' })));
</script>

<InputComp {form} {errors} label="Name" name="name" required />
<InputComp {form} {errors} label="Phone" type="tel" name="phone" required />
<InputComp {form} {errors} label="Email" type="email" name="email" required={false} />
<InputComp
	{form}
	{errors}
	label="Description"
	type="textarea"
	name="description"
	required={false}
/>

<h3 class="font-medium">Address</h3>
<InputComp {form} {errors} label="Subcity" type="combo" name="subcity" {items} required />
<InputComp {form} {errors} label="Street" name="street" required={false} />
<InputComp {form} {errors} label="Kebele" name="kebele" required={false} />
<InputComp {form} {errors} label="Building" name="buildingNumber" required={false} />
<InputComp {form} {errors} label="House number" type="number" name="houseNumber" min={0} />
<InputComp {form} {errors} label="Floor" type="number" name="floor" min={0} />
<InputComp
	{form}
	{errors}
	label="Status"
	type="select"
	name="status"
	items={[
		{ value: true, name: 'Active' },
		{ value: false, name: 'Inactive' }
	]}
/>
