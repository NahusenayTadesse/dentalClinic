import * as schema from './db/schema/';
import { seed } from 'drizzle-seed';
import { drizzle } from 'drizzle-orm/mysql2';
import 'dotenv/config';

// async function main() {
// 	const db = drizzle(process.env.DATABASE_URL!);

// 	await seed(db, { employee: schema.employee }).refine((funcs) => ({
// 		employee: {
// 			count: 10,
// 			columns: {
// 				// Generates unique identifiers and names automatically
// 				id: funcs.uuid(),
// 				username: funcs.fullName(),
// 				email: funcs.email(),

// 				// Forces every row to use your specific Argon2 hash
// 				passwordHash: funcs.valuesFromArray({
// 					values: [
// 						'$argon2id$v=19$m=19456,t=2,p=1$6SXGUz8N8ABQTN0lCQmxVw$OPPl4/OYka/gzQ94NWYEToPH1ExCCa0CErl6o8EmHHc'
// 					],
// 					isUnique: false // Allows the same value to be reused
// 				}),

// 				// Distributes role IDs between 1 and 9
// 				roleId: funcs.int({ minValue: 1, maxValue: 9 }),

// 				// Optional: Ensure isActive is always true for these 10 users
// 				isActive: funcs.valuesFromArray({
// 					values: [true]
// 				})
// 			}
// 		}
// 	}));

// 	console.log('✅ Seed completed with static Argon2 hashes!');
// }

// async function main() {
// 	const db = drizzle(process.env.DATABASE_URL!);
// 	await seed(db, {
// 		employee: schema.employee,
// 		staffFamilies: schema.staffFamilies,
// 		pension: schema.pension,
// 		employeeGuarantor: schema.employeeGuarantor
// 	}).refine((funcs) => ({
// 		// 1. Seed Tax Types first (referenced by Pension Type)

// 		// 2. Seed Pension Types

// 		// 3. Main Employee Seeding
// 		employee: {
// 			count: 1000,
// 			columns: {
// 				idNo: funcs.string({ isUnique: true }),
// 				name: funcs.firstName(),
// 				fatherName: funcs.firstName(),
// 				grandFatherName: funcs.firstName(),

// 				gender: funcs.valuesFromArray({
// 					values: ['male', 'female']
// 				}),

// 				nationality: funcs.valuesFromArray({ values: ['Ethiopia'] }),
// 				religion: funcs.valuesFromArray({ values: ['Christianity', 'Islam'] }),

// 				bloodType: funcs.valuesFromArray({
// 					values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
// 				}),

// 				departmentId: funcs.int({ minValue: 1, maxValue: 8 }),

// 				birthDate: funcs.date({
// 					minDate: new Date('1970-01-01'),
// 					maxDate: new Date('2003-12-31')
// 				}),

// 				hireDate: funcs.date({
// 					minDate: new Date('2015-01-01'),
// 					maxDate: new Date()
// 				}),

// 				employmentStatus: funcs.int({ minValue: 3, maxValue: 10 }),
// 				educationalLevel: funcs.int({ minValue: 2, maxValue: 10 }),

// 				martialStatus: funcs.valuesFromArray({
// 					values: ['single', 'married', 'divorced', 'widowed']
// 				}),

// 				isActive: funcs.boolean(),

// 				photo: funcs.valuesFromArray({ values: ['default.jpg'] }),
// 				govtId: funcs.valuesFromArray({ values: ['default.pdf'] }),

// 				createdBy: funcs.valuesFromArray({
// 					values: ['atai5lhwzaaeb5fd2jy74yt5']
// 				}),

// 				updatedBy: funcs.valuesFromArray({
// 					values: ['atai5lhwzaaeb5fd2jy74yt5']
// 				}),

// 				createdAt: funcs.date({
// 					minDate: new Date('2022-01-01'),
// 					maxDate: new Date()
// 				}),

// 				updatedAt: funcs.date({
// 					minDate: new Date('2022-01-01'),
// 					maxDate: new Date()
// 				})
// 			}
// 		},
// 		// 4. Employee Families
// 		staffFamilies: {
// 			count: 1000, // Approx 2 family members per employee
// 			columns: {
// 				createdBy: funcs.valuesFromArray({
// 					values: ['atai5lhwzaaeb5fd2jy74yt5'],
// 					isUnique: false
// 				})
// 			}
// 		},

// 		// 5. Employee Guarantors
// 		employeeGuarantor: {
// 			count: 1000,
// 			columns: {
// 				createdBy: funcs.valuesFromArray({
// 					values: ['atai5lhwzaaeb5fd2jy74yt5'],
// 					isUnique: false
// 				}),
// 				// Placeholder for mandatory address ID (Ensure address table has data)
// 				address: funcs.int({ minValue: 1, maxValue: 11 }),
// 				salary: funcs.number({ minValue: 5000, maxValue: 50000 }),
// 				gurantorDocument: funcs.valuesFromArray({ values: ['/docs/guarantor_doc.pdf'] }),
// 				photo: funcs.valuesFromArray({ values: ['/uploads/photos/g_default.jpg'] }),
// 				govtId: funcs.valuesFromArray({ values: ['/uploads/ids/g_default.pdf'] })
// 			}
// 		},

// 		// 6. Pension Records
// 		pension: {
// 			count: 1000,
// 			columns: {
// 				pensionAmount: funcs.number({ minValue: 500, maxValue: 5000 })
// 			}
// 		}
// 	}));

// 	console.log('✅ 1000 Employees and related data seeded successfully!');
// }

async function main() {
	const db = drizzle(process.env.DATABASE_URL!);
	const arr = Array.from({ length: 1000 }, (_, i) => i + 1);
	await seed(db, {
		staffContacts: schema.staffContacts
	}).refine((funcs) => ({
		staffContacts: {
			count: 1000,
			staffId: funcs.valuesFromArray({ values: arr }),
			contactType: funcs.valuesFromArray({ values: ['email', 'phone'] }),
			contactDetails:
				funcs.email() ||
				funcs.valuesFromArray({
					values: [
						'+251911000001',
						'+251911000002',
						'+251911000003',
						'+251911000004',
						'+251911000005',
						'+251911000006',
						'+251911000007',
						'+251911000008',
						'+251911000009',
						'+251911000010'
					]
				}),
			isActive: funcs.valuesFromArray({ values: [true, false] }),
			createdBy: funcs.valuesFromArray({
				values: ['atai5lhwzaaeb5fd2jy74yt5'],
				isUnique: false
			})
		}
	}));

	console.log('✅ Contacts seeded successfully!');
}

main().catch((err) => {
	console.error('❌ Seeding failed:', err);
	process.exit(1);
});
