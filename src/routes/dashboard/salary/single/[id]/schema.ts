import { z } from 'zod/v4';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from "$lib/zodschemas/appointmentSchema";


export const addLeavePayrollSchema = z.object({
  monthYear: z.string('Month and Year are required'),
  payPeriodStart: z.string('Pay Start is Requried'),  // ISO date string  YYYY-MM-DD
  payPeriodEnd: z.string('Pay End is Required'),
  baseSalary: z.coerce.number('Salary not found, Please add Salary at the Staff Page'), // decimal as string
  overtime: z.coerce.number().optional(),
  deductions: z.coerce.number().optional(),
  commissions: z.coerce.number().optional(),
  bonus: z.coerce.number().optional(),
  netAmount: z.coerce.number("Can not calculate Net Amount"),
  paidAmount: z.coerce.number("Paid Amount is Needed"),
  taxAmount: z.coerce.number().optional(),
  paymentMethod: z.number('Payment Method is Required').int().positive(),
  paymentDate: z.string('Payment Date is required'),
  notes: z.string().max(255).optional(),
  reciept: z
    .instanceof(File, { message: 'A file is required.' })
    .refine((file) => file.size > 0, 'File cannot be empty.')
    .refine((file) => file.size <= MAX_FILE_SIZE, `Max file size is 10MB.`)
    .refine((file) => ACCEPTED_FILE_TYPES.includes(file.type), 
      'Please upload a valid image (JPG, PNG, WebP, HEIC/HEIF) or PDF.'),
});

export type AddLeavePayrollInput = z.infer<typeof addLeavePayrollSchema>;