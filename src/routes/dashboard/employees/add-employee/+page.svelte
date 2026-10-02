<script lang="ts">
	import CommissionFields from '$lib/forms/CommissionFields.svelte';
	import type { Snapshot } from '@sveltejs/kit';
	import { ExternalLink, Plus } from '@lucide/svelte';
	import { Button } from '@nahu/admin-kit/components/ui/button/index.js';
	import { add } from './schema';
	import { createForm, confirmLeave } from '@nahu/admin-kit/forms/createForm.js';
	import LoadingBtn from '@nahu/admin-kit/formComponents/LoadingBtn.svelte';
	import FormCard from '@nahu/admin-kit/formComponents/FormCard.svelte';
	import Input from '$lib/formComponents/InputComp.svelte';
	import Errors from '@nahu/admin-kit/formComponents/Errors.svelte';

	let { data } = $props();

	/*
	 * This form is the example §13 cites: it carried `onUpdated` with `if (form.message)` nested
	 * inside itself, and a commented-out `$effect` underneath doing the same job a third time.
	 * `createForm` wires the validator and the toast once.
	 *
	 * `taintedMessage` earns its place here — it is a long form, and losing it to a stray back
	 * button costs real re-typing.
	 */
	const { form, errors, enhance, delayed, capture, restore, allErrors, message } = createForm(
		data.form,
		add,
		{ taintedMessage: confirmLeave }
	);

	export const snapshot: Snapshot = { capture, restore };

	const genders = [
		{ value: 'male', name: 'Male' },
		{ value: 'female', name: 'Female' }
	];

	const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({
		value: v,
		name: v
	}));

	const maritalStatuses = ['single', 'married', 'widowed', 'divorced', 'other'].map((v) => ({
		value: v,
		name: v.charAt(0).toUpperCase() + v.slice(1)
	}));

	const sectionStyle = `flex flex-col gap-4 my-4`;
	const rowStyle = `grid lg:grid-cols-3 grid-cols-1 mt-4  gap-4`;

	/*
	 * `$form` holds what was typed, which for a `z.coerce.number()` field is whatever the input
	 * gave — a number once Svelte has coerced a `type="number"` binding, but `undefined` while the
	 * field is still empty. Adding that produced `NaN`, so the running total read "NaN" until
	 * every allowance had been filled in. `Number(x) || 0` treats blank as nothing, which is what
	 * an empty allowance means.
	 */
	const money = (value: unknown) => Number(value) || 0;

	const total = $derived(
		money($form.positionAllowance) +
			money($form.nonTaxAllowance) +
			money($form.housingAllowance) +
			money($form.transportAllowance) +
			money($form.salary)
	);
</script>

<svelte:head>
	<title>Add New Employee</title>
</svelte:head>

<FormCard title="Add New Employee" className="lg:w-full!">
	<!-- EmployeeAddForm.svelte -->

	<form
		use:enhance
		action="?/add"
		id="main"
		method="POST"
		enctype="multipart/form-data"
		class="grid-form"
	>
		<!-- 1. PERSONAL INFO -->
		<section class={sectionStyle}>
			<h4>Personal Information</h4>

			{#if $message?.existingId}
				<Button
					class="w-48"
					target="_blank"
					href="/dashboard/employees/single/{$message.existingId}"
				>
					<ExternalLink /> View Existing Profile</Button
				>
				<Input
					label="Verify Employee's Identity"
					name="newEmployeeVerified"
					{form}
					{errors}
					type="checkboxSingle"
					placeholder="This is Employee is new and register them."
				/>
			{/if}

			<div class={rowStyle}>
				<Input
					label="Name"
					name="name"
					{form}
					placeholder="Enter Name"
					{errors}
					type="text"
					required
				/>
				<Input
					label="Father Name"
					name="fatherName"
					{form}
					placeholder="Enter Father Name"
					{errors}
					type="text"
					required
				/>

				<Input
					label="Grandfather Name"
					name="grandFatherName"
					{form}
					placeholder="Enter Grandfather Name"
					{errors}
					type="text"
					required
				/>
				<Input
					label="Gender"
					name="gender"
					{form}
					placeholder="Select Gender"
					{errors}
					type="select"
					items={genders}
					required
				/>
				<Input
					label="Phone"
					name="phone"
					{form}
					placeholder="Enter Phone Number"
					{errors}
					type="tel"
					required
				/>
				<Input label="Email" name="email" placeholder="Enter Email" {form} {errors} type="email" />
				<Input label="Nationality" name="nationality" {form} {errors} type="text" />
				<Input
					label="Blood Type"
					name="bloodType"
					{form}
					{errors}
					type="select"
					items={bloodTypes}
				/>
				<Input
					label="Birth Date"
					name="birthDate"
					year
					{form}
					{errors}
					type="date"
					required
					futureDays
				/>
				<Input
					label="Marital Status"
					name="martialStatus"
					{form}
					{errors}
					type="select"
					items={maritalStatuses}
				/>
			</div>

			<h4>Address</h4>

			<div class={rowStyle}>
				<Input
					label="Subcity"
					name="subcity"
					type="combo"
					{form}
					{errors}
					items={data?.subcityList}
				/>
				<Input
					label="Other Subcity"
					name="otherSubcity"
					type="text"
					{form}
					{errors}
					placeholder="Enter other subcity if subcity is not available, leave blank otherwise"
				/>
				<Input label="Street" name="street" type="text" {form} {errors} />
				<Input label="Kebele" name="kebele" type="text" {form} {errors} />
				<Input label="Building Name or Number" name="buildingNumber" type="text" {form} {errors} />
				<Input label="Floor" name="floor" type="number" {form} {errors} />
				<Input label="House Number" name="houseNumber" type="text" {form} {errors} />
				<Input
					label="Status"
					name="status"
					type="select"
					{form}
					{errors}
					required
					items={[
						{ value: true, name: 'Active' },
						{ value: false, name: 'Inactive' }
					]}
				/>
			</div>
		</section>

		<!-- 2. GOVERNMENT / LEGAL -->
		<section class={sectionStyle}>
			<h4>Government & Legal</h4>
			<div class={rowStyle}>
				<Input
					label="TIN (10 digits)"
					name="tinNo"
					placeholder="Enter TIN"
					{form}
					{errors}
					type="text"
				/>
				<Input
					label="Government ID"
					name="govtId"
					{form}
					{errors}
					type="file"
					required
					placeholder="Upload a FIDA or A recent ID of Employee"
				/>
				<Input
					label="Photo"
					name="photo"
					{form}
					{errors}
					type="file"
					required
					placeholder="Upload a recent photo of Employee 4 X 4 with good Quality, Max 10MB"
				/>
				<Input
					label="Signature"
					name="signature"
					{form}
					{errors}
					type="file"
					placeholder="Upload a signature of Employee with good Quality, Max 10MB"
				/>

				<Input
					label="Pension Card"
					name="existingPensionCard"
					placeholder="Enter TIN"
					{form}
					{errors}
					type="select"
					items={[
						{ value: false, name: 'No' },
						{ value: true, name: 'Yes' }
					]}
				/>

				{#if $form.existingPensionCard === true}
					<Input
						label="Pension Card Image or PDF"
						name="pensionCard"
						{form}
						{errors}
						type="file"
						placeholder="Upload a recent photo of Pension Card"
					/>
				{/if}
			</div>
		</section>

		<!-- 3. JOB DETAILS -->
		<section class={sectionStyle}>
			<h4>Job Details</h4>
			<div class={rowStyle}>
				<Input
					label="Department"
					name="department"
					{form}
					{errors}
					type="select"
					items={data?.departmentList}
					required
				/>

				<Input
					label="Position"
					name="position"
					{form}
					{errors}
					type="combo"
					items={$form.department
						? data.positionList.filter((p) => p.departmentId === Number($form.department))
						: [{ value: '', name: 'Select a Department First' }]}
					required
				/>

				<CommissionFields {form} {errors} />
				<Input
					label="Employment Status"
					name="employmentStatus"
					{form}
					{errors}
					type="combo"
					items={data?.empStatusList}
					required
				/>
				<Input
					label="Hire Date"
					name="hireDate"
					year
					{form}
					{errors}
					type="date"
					required
					oldDays
					futureDays={false}
				/>
			</div>

			<div class={rowStyle}>
				<Input
					label="Educational Level"
					name="educationalLevel"
					{form}
					{errors}
					type="select"
					items={data?.eduLevelList}
				/>
				<Input label="Basic Salary (ETB)" name="salary" {form} {errors} type="number" required />
				<Input
					label="Tranport Allowance (ETB)"
					name="transportAllowance"
					{form}
					{errors}
					type="number"
					required
				/>
			</div>
			<div class={rowStyle}>
				<Input
					label="Housing Allowance (ETB)"
					name="housingAllowance"
					{form}
					{errors}
					type="number"
					required
				/>
				<Input
					label="Non Tax Allowance (ETB)"
					name="nonTaxAllowance"
					{form}
					{errors}
					type="number"
					required
				/>

				<Input
					label="Positional Allowance (ETB)"
					name="positionAllowance"
					{form}
					{errors}
					type="number"
					required
				/>
			</div>
			<h4>Gross Salary (ETB) {total}</h4>
		</section>

		<section class={sectionStyle}>
			<Errors allErrors={$allErrors} />
			<Button type="submit" form="main">
				{#if $delayed}
					<LoadingBtn name="Adding Employee" />
				{:else}
					<Plus class="h-4 w-4" />
					Add Employee
				{/if}
			</Button>
		</section>
	</form>
</FormCard>
