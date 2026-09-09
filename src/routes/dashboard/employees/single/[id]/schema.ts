import { z } from 'zod/v4';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '$lib/zodschemas/appointmentSchema';

export const terminate = z.object({
	reason: z.string().min(2).max(255),
	terminationDate: z.coerce.string('Termination Date is Required'),
	terminationLetter: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional()
});

export type Terminate = z.infer<typeof terminate>;

export const reinstate = z.object({
	newStatus: z.coerce.number('New Status is Required')
});
export type Reinstate = z.infer<typeof reinstate>;

export const editIdentity = z.object({
	firstName: z.string().min(2).max(255),
	fatherName: z.string().min(2).max(255),
	grandFatherName: z.string().min(2).max(255),
	gender: z.enum(['male', 'female']),
	birthDate: z.coerce.string('Birth date is required').refine(
		(value) => {
			const birth = new Date(value);

			// invalid date guard
			if (isNaN(birth.getTime())) return false;

			const today = new Date();
			let age = today.getFullYear() - birth.getFullYear();
			const m = today.getMonth() - birth.getMonth();

			if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
				age--;
			}

			return age >= 18;
		},
		{
			message: 'You must be at least 18 years old'
		}
	),
	nationality: z.string('Nationality is requried').default('Ethiopia'),
	photo: z.file('Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.').optional(),
	govtId: z.file('Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.').optional(),
	signature: z.file('Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.').optional(),
	pensionCard: z.file('Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.').optional(),
	existingPensionCard: z.boolean().default(false)
});
export type EditIdentity = z.infer<typeof editIdentity>;

export const editEmployment = z.object({
	idNo: z.string('ID Number is required'),
	hireDate: z.coerce.string('Hired on date is required'),
	employmentStatus: z.number('Employment Status is required'),
	leavesLeft: z.number('Leaves Left is required').default(0),
	educationalLevel: z.number('Educational Level is required').optional(),
	officeCommission: z.boolean('Office Commission is required').default(false),
	percentage: z.number('Percentage is required').default(0)
});
export type EditEmployment = z.infer<typeof editEmployment>;

export const editPersonal = z.object({
	bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
	tinNo: z.string().min(10).max(10).optional(),
	martialStatus: z.enum(['single', 'married', 'widowed', 'divorced', 'other'])
});
export type EditPersonal = z.infer<typeof editPersonal>;

export const editAddress = z.object({
	id: z.number('Address Id not found'),
	subcity: z.number('Subsity is required').optional(),
	street: z.string('Street is required').optional(),
	kebele: z.string('Kebele is required').optional(),
	buildingNumber: z.string().optional().optional(),
	floor: z.string().optional().optional(),
	houseNumber: z.string('House Number is Required').optional(),
	status: z.boolean('Status is required').optional(),
	otherSubcity: z.string().optional()
});
export type EditAddress = z.infer<typeof editAddress>;

const RelationShipEnum = z.enum(
	[
		'mother',
		'father',
		'spouse',
		'son',
		'daughter',
		'grandchild',
		'grandfather',
		'grandmother',
		'uncle',
		'aunt',
		'brother',
		'sister',
		'other'
	],
	'Relationship is required'
);
export const editFamily = z.object({
	id: z.number('Family Member is not Found'),
	name: z.string('Family member is required').min(1).max(100),
	gender: z.enum(['male', 'female'], {
		message: 'Please select a valid gender'
	}),

	phone: z.string().optional(),
	email: z.string().optional(),
	emergencyContact: z.boolean().default(false),
	otherRelationShip: z.string().optional(),
	relationShip: RelationShipEnum,
	status: z.boolean().default(true)
});
export type EditFamily = z.infer<typeof editFamily>;

export const addFamily = z.object({
	name: z.string('Family member is required').min(1).max(100),
	gender: z.enum(['male', 'female'], {
		message: 'Please select a valid gender'
	}),

	phone: z.string().optional(),
	email: z.string().optional(),
	emergencyContact: z.boolean().default(false),
	otherRelationShip: z.string().optional(),
	relationShip: RelationShipEnum,
	status: z.boolean().default(true)
});

export type AddFamily = z.infer<typeof addFamily>;

export const addQualification = z.object({
	field: z.string('Field name is required').min(1).max(100),

	educationalLevel: z.number('Educational Level is required'),
	schoolName: z.string('School Name is required'),
	graduationDate: z.string('Graduation Date is required'),
	certificate: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional()
});

export type AddQualification = z.infer<typeof addQualification>;

export const editQualification = z.object({
	id: z.number('Qualification not Found'),

	field: z.string('Field name is required').min(1).max(100),

	educationalLevel: z.number('Educational Level is required'),
	schoolName: z.string('School Name is required'),
	graduationDate: z.string('Graduation Date is required'),
	certificate: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional()
});
export type EditQualification = z.infer<typeof editQualification>;

export const addExperience = z.object({
	companyName: z.string('Company Name is required').min(1).max(100),

	position: z.string('Position is required'),
	startDate: z.string('Start Date is required'),
	endDate: z.string('End Date is required'),
	description: z.string().optional(),
	certificate: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional()
});

export type AddExperience = z.infer<typeof addExperience>;

export const editExperience = z.object({
	id: z.number('Experience not Found'),

	companyName: z.string('Company Name is required').min(1).max(100),

	position: z.string('Position is required'),
	startDate: z.string('Start Date is required'),
	endDate: z.string('End Date is required'),
	description: z.string().optional(),
	certificate: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional()
});

export type EditExperience = z.infer<typeof editExperience>;

export const editGuarantor = z.object({
	id: z.number('Guarantor not Found'),
	name: z.string('Name is required').min(1).max(100),
	phone: z
		.string('Phone is required')
		.min(1)
		.max(15, 'Phone number must be between 1 and 15 characters'),
	email: z.string('Email is required').optional(),
	jobType: z.string('Job type is required').min(1).max(100),
	company: z.string('Company Name is required').min(1).max(100),
	relationship: z.enum([
		'mother',
		'father',
		'spouse',
		'brother',
		'sister',
		'son',
		'daughter',
		'other'
	]),
	relation: z.string().optional(),
	salary: z.number('Salary is required').min(0).max(1000000),
	photo: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional(),
	govtId: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional(),
	document: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional()
});
export type EditGuarantor = z.infer<typeof editGuarantor>;

export const addGuarantor = z.object({
	name: z.string('Name is required').min(1).max(100),
	phone: z
		.string('Phone is required')
		.min(1)
		.max(15, 'Phone number must be between 1 and 15 characters'),
	email: z.string('Email is required').optional(),
	jobType: z.string('Job type is required').min(1).max(100),
	company: z.string('Company Name is required').min(1).max(100),
	relationship: z.enum([
		'mother',
		'father',
		'spouse',
		'brother',
		'sister',
		'son',
		'daughter',
		'other'
	]),
	relation: z.string().optional(),
	salary: z.number('Salary is required').min(0).max(1000000),
	photo: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional(),
	govtId: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional(),
	document: z
		.instanceof(File, {
			message: 'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		})
		.refine((file) => file.size > 0, 'File cannot be empty.')
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine(
			(file) => ACCEPTED_FILE_TYPES.includes(file.type),
			'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'
		)
		.optional(),
	subcity: z.number('Subsity is required').optional(),
	otherSubcity: z.string().optional(),
	street: z.string('Street is required').optional(),
	kebele: z.string('Kebele is required').optional(),
	buildingNumber: z.string().optional(),
	floor: z.string().optional(),
	houseNumber: z.string('House Number is Required').optional()
});
export type AddGuarantor = z.infer<typeof addGuarantor>;

export const addSchedule = z.object({
	day: z.number('Day is Required'),
	startTime: z.string('Start Time is required'),
	endTime: z.string('End Time is required'),
	status: z.boolean('Status is Required').default(true)
});
export type AddSchedule = z.infer<typeof addSchedule>;

export const editSchedule = z.object({
	id: z.number('Schedule not found'),
	day: z.number('Day is Required'),
	startTime: z.string('Start Time is required'),
	endTime: z.string('End Time is required'),
	status: z.boolean('Status is Required').default(true)
});
export type EditSchedule = z.infer<typeof editSchedule>;

export const addContact = z.object({
	contactType: z.string('Contact Type is Required'),
	contactDetail: z.string('Contact Detail is required'),
	status: z.boolean('Status is Required').default(true)
});
export type AddContact = z.infer<typeof addContact>;

export const editContact = z.object({
	id: z.number('Schedule not found'),
	contactType: z.string('Contact Type is Required'),
	contactDetail: z.string('Contact Detail is required'),

	status: z.boolean('Status is Required').default(true)
});

export type EditContact = z.infer<typeof editContact>;

export const addAccount = z.object({
	paymentMethod: z.number('Bank Name is Required'),
	accountDetail: z.string('Account Detail is required').optional(),
	status: z.boolean('Status is Required').default(true)
});
export type AddAccount = z.infer<typeof addAccount>;

export const editAccount = z.object({
	id: z.number('Schedule not found'),
	paymentMethod: z.number('Bank Name is Required'),
	accountDetail: z.string('Account Detail is required'),
	status: z.boolean('Status is Required').default(true)
});

export type EditAccount = z.infer<typeof editAccount>;

export const editCommission = z.object({
	percentage: z.number('Percentage is Required').default(0),
	status: z.boolean('Status is Required').default(true)
});

export type EditCommission = z.infer<typeof editCommission>;
