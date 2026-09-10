import { z } from 'zod/v4';
import { MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from './zodschemas/appointmentSchema';

export const loginSchema = z.object({
	email: z.email({ error: 'Invalid email address' }),
	password: z.string().min(8, { error: 'Password must be at least 8 characters' })
});
export type LoginSchema = typeof loginSchema;

export const addUserSchema = z.object({
	name: z
		.number('Employee is Required.')
		.nonnegative('Employee is Required.')
		.positive('Employee is Required.'),

	email: z.email('Invalid email address').min(1, 'Email is required'),
	password: z
		.string()
		.min(6, 'Password must be at least 6 characters')
		.max(128, 'Password must be less than 128 characters'),
	role: z.number('Role is required').nonnegative('Role is Required.').positive('Role is Required.')
});

export type AddUserSchema = typeof addUserSchema;

export const inventoryItemSchema = z.object({
	productName: z.string().min(1, { message: 'Product Name is required.' }),
	category: z.number('Category cannot be empty. Please select a Category'),

	description: z
		.string()
		.max(500, { message: "Product description can't be more than 500 characters." })
		.optional(),
	quantity: z.coerce
		.number()
		.int({ message: 'Quantity can only be full numbers, no decimals.' })
		.positive({ message: 'Quantity must be a positive number.' }),
	price: z
		.number({ message: 'Price is required' })
		.positive({ message: 'Price must be a positive number.' }),
	commission: z
		.number({ message: 'Commission is required, enter 0 if it is not decided yet' })
		.positive({ message: 'Price must be a positive number.' }),
	supplier: z.string().min(1, { message: 'Supplier is required.' }),
	reorderLevel: z.coerce
		.number()
		.int({ message: 'Reorder Level can only be full numbers, no decimals.' })
		.positive({ message: 'Reorder Level must be a positive number.' }),

	costPerUnit: z
		.number({ message: 'Cost is required' })
		.positive({ message: 'Cost must be a positive number.' })
});

export type InventoryItemSchema = typeof inventoryItemSchema;

export const editProduct = z.object({
	productId: z.number(),
	productName: z.string().min(1, { message: 'Product Name is required.' }),
	category: z.number('Category cannot be empty. Please select a Category'),

	description: z
		.string()
		.max(500, { message: "Product description can't be more than 500 characters." })
		.optional(),
	quantity: z.coerce
		.number()
		.int({ message: 'Quantity can only be full numbers, no decimals.' })
		.positive({ message: 'Quantity must be a positive number.' }),
	price: z.coerce
		.number({ message: 'Price is required' })
		.positive({ message: 'Price must be a positive number.' }),
	commission: z.coerce
		.number({ message: 'Commission is required, enter 0 if it is not decided yet' })
		.nonnegative({ message: 'Price must be a positive number.' }),
	supplier: z.string().min(1, { message: 'Supplier is required.' }),
	reorderLevel: z.coerce
		.number()
		.int({ message: 'Reorder Level can only be full numbers, no decimals.' })
		.positive({ message: 'Reorder Level must be a positive number.' }),

	costPerUnit: z.coerce
		.number({ message: 'Cost Per Unit is required' })
		.positive({ message: 'Cost Per Unit must be a positive number.' })
});

export type EditProduct = typeof editProduct;

export const supplyItemSchema = z.object({
	supplyName: z.string().min(1, { message: 'Product Name is required.' }),

	description: z
		.string()
		.max(500, { message: "Product description can't be more than 500 characters." })
		.optional(),
	quantity: z.coerce
		.number()
		.int({ message: 'Quantity can only be full numbers, no decimals.' })
		.positive({ message: 'Quantity must be a positive number.' }),
	unitOfMeasure: z.coerce.string(),
	reorderLevel: z.coerce
		.number()
		.int({ message: 'Reorder Level can only be full numbers, no decimals.' })
		.positive({ message: 'Reorder Level must be a positive number.' }),

	costPerUnit: z.coerce
		.number({ message: 'Cost is required' })
		.positive({ message: 'Cost must be a positive number.' }),
	supplier: z.string().min(1, { message: 'Supplier is required.' })
});

export type SupplyItemSchema = typeof supplyItemSchema;

export const editSupply = z.object({
	supplyId: z.number(),

	supplyName: z.string().min(1, { message: 'Product Name is required.' }),

	description: z
		.string()
		.max(500, { message: "Product description can't be more than 500 characters." })
		.optional(),
	quantity: z.coerce
		.number()
		.int({ message: 'Quantity can only be full numbers, no decimals.' })
		.positive({ message: 'Quantity must be a positive number.' }),
	unitOfMeasure: z.coerce.string(),
	reorderLevel: z.coerce
		.number()
		.int({ message: 'Reorder Level can only be full numbers, no decimals.' })
		.positive({ message: 'Reorder Level must be a positive number.' }),

	costPerUnit: z.coerce
		.number({ message: 'Cost is required' })
		.positive({ message: 'Cost must be a positive number.' }),
	supplier: z.string().min(1, { message: 'Supplier is required.' })
});

export type EditSupply = typeof editSupply;

export const serviceSchema = z.object({
	serviceName: z.string().min(1, { message: 'Service Name is required.' }),
	description: z.string().optional(),
	commission: z.coerce
		.number({ message: 'Commission is required, enter 0 if it is not decided yet' })
		.nonnegative({ message: 'Price must be a positive number.' }),

	category: z.number('Category cannot be empty. Please select a Category'),
	durationMinutes: z.coerce
		.number()
		.int()
		.positive({ message: 'Duration Minutes must be a positive integer.' }),
	price: z.coerce.number().positive({ message: 'Price must be a positive number.' })
});

export type ServiceSchema = typeof serviceSchema;

export const editService = z.object({
	serviceId: z.number(),
	serviceName: z.string().min(1, { message: 'Service Name is required.' }),
	commission: z.coerce
		.number({ message: 'Commission is required, enter 0 if it is not decided yet' })
		.nonnegative({ message: 'Price must be a positive number.' }),

	description: z.string().optional(),
	category: z.number('Category cannot be empty. Please select a Category'),
	durationMinutes: z.coerce
		.number()
		.int()
		.positive({ message: 'Duration Minutes must be a positive integer.' }),
	price: z.coerce.number().positive({ message: 'Price must be a positive number.' })
});

export type EditService = typeof editService;

export const createRoleSchema = z.object({
	name: z
		.string()
		.min(1, 'Role name is required')
		.max(100, 'Role name must be under 100 characters'),

	description: z
		.string()
		.min(1, 'Role description is required')
		.max(500, 'Role description must be under 500 characters'),

	permissions: z.array(z.string().min(1)).nonempty('At least one permission must be selected')
});

export type CreateRoleSchema = z.infer<typeof createRoleSchema>;

export const positionSchema = z.object({
	name: z
		.string()
		.min(1, 'Role name is required')
		.max(100, 'Role name must be under 100 characters'),

	description: z
		.string()
		.min(1, 'Role description is required')
		.max(500, 'Role description must be under 500 characters')
});
export type PositionSchema = z.infer<typeof positionSchema>;

export const serviceCategorySchema = z.object({
	name: z
		.string()
		.min(1, 'Role name is required')
		.max(100, 'Role name must be under 100 characters'),

	description: z
		.string()
		.min(1, 'Role description is required')
		.max(500, 'Role description must be under 500 characters')
});

export type ServiceCategorySchema = z.infer<typeof serviceCategorySchema>;

const today = new Date();
today.setHours(0, 0, 0, 0);

export const appointmentSchema = z.object({
	firstName: z.string().min(1, 'First name is required').max(50, 'First name is too long'),
	lastName: z.string().max(50, 'Last name is too long').optional().or(z.literal('')),
	phone: z
		.string()
		.min(7, 'Phone number is too short')
		.max(15, 'Phone number is too long')
		.regex(/^[0-9+\-()\s]+$/, 'Invalid phone number'),
	gender: z.string().refine((val) => ['male', 'female'].includes(val), {
		message: 'Please select a gender'
	}),
	appointmentDate: z.string().refine(
		(val) => {
			const d = new Date(val);
			return !isNaN(d.getTime()) && d >= today;
		},
		{ message: 'Date must be today or in the future' }
	),
	appointmentTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
	notes: z.string().max(500, 'Notes must be less than 500 characters').optional().or(z.literal('')) // allow empty string
});

// TypeScript type inference
export type AppointmentForm = z.infer<typeof appointmentSchema>;

export const existingCustomerAppointment = z.object({
	customerId: z.number('Customer is required'),
	appointmentDate: z.string().refine(
		(val) => {
			const d = new Date(val);
			return !isNaN(d.getTime()) && d >= today;
		},
		{ message: 'Date must be today or in the future' }
	),
	appointmentTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
	notes: z.string().max(500, 'Notes must be less than 500 characters').optional().or(z.literal(''))
});

// TypeScript type inference
export type ExistingCustomerAppointmentForm = z.infer<typeof existingCustomerAppointment>;

export const editAppointment = z.object({
	customerId: z.number('Customer is required'),
	appointmentDate: z.string().refine(
		(val) => {
			const d = new Date(val);
			return !isNaN(d.getTime()) && d >= today;
		},
		{ message: 'Date must be today or in the future' }
	),
	appointmentTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),

	notes: z.string().max(500, 'Notes must be less than 500 characters').optional().or(z.literal('')),
	appointmentId: z.number()
});

// TypeScript type inference
export type EditAppointment = z.infer<typeof editAppointment>;

export const editCustomer = z.object({
	firstName: z.string().min(1, 'First name is required').max(50, 'First name is too long'),
	lastName: z.string().max(50, 'Last name is too long').optional().or(z.literal('')),
	phone: z
		.string()
		.min(7, 'Phone number is too short')
		.max(15, 'Phone number is too long')
		.regex(/^[0-9+\-()\s]+$/, 'Invalid phone number'),
	gender: z.string().refine((val) => ['male', 'female'].includes(val), {
		message: 'Please select a gender'
	}),
	customerId: z.number()
});

export type EditCustomer = z.infer<typeof editCustomer>;

export const addCustomer = z.object({
	firstName: z.string().min(1, 'First name is required').max(50, 'First name is too long'),
	lastName: z.string().max(50, 'Last name is too long').optional().or(z.literal('')),
	phone: z
		.string()
		.min(7, 'Phone number is too short')
		.max(15, 'Phone number is too long')
		.regex(/^[0-9+\-()\s]+$/, 'Invalid phone number'),
	gender: z.string().refine((val) => ['male', 'female'].includes(val), {
		message: 'Please select a gender'
	})
});

export type AddCustomerSchema = z.infer<typeof addCustomer>;

export const inventoryAdjustmentFormSchema = z.object({
	intent: z.enum(['add', 'remove'], {
		message: 'Please select an adjustment type'
	}),

	costPerItem: z.coerce
		.number('Cost per unit must be a number')
		.min(0, 'Cost per unit must be greater than 0'),

	employeeResponsible: z.coerce.string('Employee is required'),
	quantity: z.coerce.string('Quantity must be greater than 0'),

	reason: z.string().max(255).optional(),

	/**
	 * Bank account the stock was paid from. Optional because removing stock costs
	 * nothing; the action requires it whenever there is money to move.
	 */
	paymentMethod: z.coerce.number().int().positive().optional(),

	/** Set by the user when the purchase would take the account below zero. */

	// Move .optional() inside the field definition
	reciept: z
		.instanceof(File)
		.refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
		.refine((file) => ACCEPTED_FILE_TYPES.includes(file.type), 'Invalid file type.')
		.optional() // Now only the receipt can be undefined
});
export type InventoryAdjustmentForm = z.infer<typeof inventoryAdjustmentFormSchema>;

export const damagedFormSchema = z.object({
	damagedBy: z.coerce.string('Employee is required'),
	quantity: z.coerce.string('Quantity must be greater than 0'),

	reason: z.string().max(255).optional(),

	// Move .optional() inside the field definition
	deductable: z.boolean('Deductable is required').default(true)
});

export type DamagedForm = z.infer<typeof damagedFormSchema>;
