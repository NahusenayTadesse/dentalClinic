<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import { ExternalLink, Plus } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { add } from './schema';
	import { superForm } from 'sveltekit-superforms/client';
	import LoadingBtn from '$lib/formComponents/LoadingBtn.svelte';
	import FormCard from '$lib/formComponents/FormCard.svelte';
	import Input from '$lib/formComponents/InputComp.svelte';
	import Errors from '$lib/formComponents/Errors.svelte';

	let { data } = $props();
	const { form, errors, enhance, message, delayed, capture, restore, allErrors } = superForm(
		data.form,
		{
			taintedMessage: () => {
				return new Promise((resolve) => {
					resolve(window.confirm('Do you want to leave?\nChanges you made may not be saved.'));
				});
			},

			onUpdated({ form }) {
				if (form.message) {
					if (form.message) {
						if (form.message.type === 'error') {
							toast.error(form.message.text);
						} else {
							toast.success(form.message.text);
						}
					}
				}
			},

			validators: zod4Client(add)
		}
	);

	export const snapshot: Snapshot = { capture, restore };
	import { toast } from 'svelte-sonner';
	// $effect(() => {
	// 	if ($message) {
	// 		if ($message.type === 'error') {
	// 			toast.error($message.text);
	// 		} else {
	// 			toast.success($message.text);
	// 		}
	// 	}
	// });
	// 	 function getItemNameById(items: any, value: any) {
	//   const item = items.find(i=> i.value === value);
	//   return item ? item.name : null; // returns null if not found
	// }
	//
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

	const total = $derived(
		$form.positionAllowance +
			$form.nonTaxAllowance +
			$form.housingAllowance +
			$form.transportAllowance +
			$form.salary
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

				{#if data?.departmentList.find((d) => d.value === $form.department)?.commission}
					<Input
						label="Office Commission"
						name="officeCommission"
						{form}
						{errors}
						type="select"
						items={[
							{ value: false, name: 'No' },
							{ value: true, name: 'Yes' }
						]}
						required
						placeholder="This Employee Recieves Office Commission"
					/>

					{#if $form.officeCommission}
						<Input
							label="Commission Percentage"
							name="percentage"
							{form}
							{errors}
							type="number"
							max="50"
							required
						/>
					{/if}
				{/if}
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
					label="Branch"
					name="branch"
					{form}
					{errors}
					type="combo"
					items={data?.branchList}
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
