/**
 * The lists a clinic would fill in before using the app: where places are, what staff are paid
 * under, what the clinic sells, and how money is taken.
 *
 * Seeded because half the screens are unusable without them — an address needs a subcity, payroll
 * needs a tax schedule, an expense needs a type — and because an empty picker hides whatever bug
 * lives behind it.
 *
 * The one judgement call is the tax schedule: those numbers change what payroll pays, so they are
 * the published federal PAYE bands rather than invented ones, and a clinic must still confirm them
 * against the current proclamation before running real payroll.
 */
import { eq } from 'drizzle-orm';

import {
	educationalLevel,
	leaveType,
	annualLeaveEntitlement,
	leaveExpiryPolicy,
	overTimeType,
	taxType
} from '../../src/lib/server/db/schema/staff';
import { region, city, subcity, address } from '../../src/lib/server/db/schema/locations';
import { serviceCategories, services } from '../../src/lib/server/db/schema/services';
import {
	paymentMethods,
	expensesType,
	vatAndWithHold
} from '../../src/lib/server/db/schema/finance';
import { isEmpty, money, type SeedDb } from './util';

const REGIONS = ['Addis Ababa', 'Oromia'];

const CITIES: Record<string, string[]> = {
	'Addis Ababa': ['Addis Ababa'],
	Oromia: ['Adama', 'Bishoftu']
};

const SUBCITIES: Record<string, string[]> = {
	'Addis Ababa': ['Bole', 'Kirkos', 'Yeka', 'Arada', 'Lideta', 'Nifas Silk'],
	Adama: ['Dabe', 'Boku'],
	Bishoftu: ['Kebele 01', 'Kebele 04']
};

export async function seedLocations(db: SeedDb) {
	if (!(await isEmpty(db, region, 'region'))) return;

	for (const regionName of REGIONS) {
		await db.insert(region).values({ name: regionName });
		const [{ id: regionId }] = await db
			.select({ id: region.id })
			.from(region)
			.where(eq(region.name, regionName));

		for (const cityName of CITIES[regionName]) {
			await db.insert(city).values({ name: cityName, regionId });
			const [{ id: cityId }] = await db
				.select({ id: city.id })
				.from(city)
				.where(eq(city.name, cityName));

			for (const name of SUBCITIES[cityName] ?? []) {
				await db.insert(subcity).values({ name, cityId });
			}
		}
	}

	console.log('Seeded regions, cities and subcities.');
}

/**
 * One address row, returned by id — suppliers, guarantors and customers each need their own.
 *
 * `floor` and `houseNumber` are optional on purpose: plenty of addresses here are a subcity and a
 * street and nothing more, and the address cell is meant to leave out what it was not given.
 */
export async function makeAddress(
	db: SeedDb,
	values: {
		subcityId?: number | null;
		street: string;
		kebele: string;
		buildingNumber?: string;
		floor?: number;
		houseNumber?: number;
	}
): Promise<number> {
	const [row] = await db.insert(address).values(values).$returningId();
	return row.id;
}

export async function seedHrReference(db: SeedDb) {
	if (await isEmpty(db, educationalLevel, 'educational_level')) {
		await db
			.insert(educationalLevel)
			.values(
				['Below Grade 10', 'Grade 10 Complete', 'Certificate', 'Diploma', 'Degree', 'Masters'].map(
					(name, i) => ({ name, sortOrder: i })
				)
			);
	}

	if (await isEmpty(db, leaveType, 'leave_type')) {
		await db.insert(leaveType).values([
			{
				name: 'Annual Leave',
				maxDays: 0,
				deductsBalance: true,
				description: 'Drawn from the balance'
			},
			{ name: 'Sick Leave', maxDays: 10, deductsBalance: false },
			{ name: 'Marriage Leave', maxDays: 5, deductsBalance: false },
			{ name: 'Maternity Leave', maxDays: 120, deductsBalance: false },
			{ name: 'Paternity Leave', maxDays: 3, deductsBalance: false },
			{ name: 'Mourning Leave', maxDays: 5, deductsBalance: false },
			{ name: 'Unpaid Leave', maxDays: 30, deductsBalance: false }
		]);
	}

	if (await isEmpty(db, annualLeaveEntitlement, 'annual_leave_entitlement')) {
		// The statutory shape here: sixteen days for the first year, one more every two years.
		await db.insert(annualLeaveEntitlement).values([
			{ fromYears: 0, toYears: 1, days: 16 },
			{ fromYears: 2, toYears: 3, days: 17 },
			{ fromYears: 4, toYears: 5, days: 18 },
			{ fromYears: 6, toYears: 9, days: 20 },
			{ fromYears: 10, toYears: null, days: 22 }
		]);
	}

	if (await isEmpty(db, leaveExpiryPolicy, 'leave_expiry_policy')) {
		await db.insert(leaveExpiryPolicy).values({
			name: 'Carry over two years',
			expiryYears: 2,
			description: 'Unused annual leave expires two years after it was granted'
		});
	}

	if (await isEmpty(db, overTimeType, 'over_time_type')) {
		await db.insert(overTimeType).values([
			{ name: 'Weekday evening', rate: money(1.5) },
			{ name: 'Night', rate: money(1.75) },
			{ name: 'Weekend', rate: money(2) },
			{ name: 'Public holiday', rate: money(2.5) }
		]);
	}

	if (await isEmpty(db, taxType, 'tax_type')) {
		/*
		 * The federal employment income tax bands. Seeded with their real figures because invented
		 * ones would make every payroll figure in development quietly wrong — and confirm them
		 * against the current proclamation before any real payroll run.
		 */
		await db.insert(taxType).values([
			{ name: 'Band 1 (0 – 600)', threshold: money(600), rate: money(0), deduction: money(0) },
			{
				name: 'Band 2 (601 – 1,650)',
				threshold: money(1650),
				rate: money(10),
				deduction: money(60)
			},
			{
				name: 'Band 3 (1,651 – 3,200)',
				threshold: money(3200),
				rate: money(15),
				deduction: money(142.5)
			},
			{
				name: 'Band 4 (3,201 – 5,250)',
				threshold: money(5250),
				rate: money(20),
				deduction: money(302.5)
			},
			{
				name: 'Band 5 (5,251 – 7,800)',
				threshold: money(7800),
				rate: money(25),
				deduction: money(565)
			},
			{
				name: 'Band 6 (7,801 – 10,900)',
				threshold: money(10900),
				rate: money(30),
				deduction: money(955)
			},
			{ name: 'Band 7 (above 10,900)', threshold: null, rate: money(35), deduction: money(1500) }
		]);
	}

	console.log('Seeded HR reference data.');
}

export async function seedFinanceReference(db: SeedDb) {
	if (await isEmpty(db, paymentMethods, 'payment_methods')) {
		await db
			.insert(paymentMethods)
			.values(
				[
					'Commercial Bank of Ethiopia',
					'Awash Bank',
					'Dashen Bank',
					'Abyssinia Bank',
					'Telebirr',
					'Cash'
				].map((name) => ({ name }))
			);
	}

	if (await isEmpty(db, expensesType, 'expenses_type')) {
		await db
			.insert(expensesType)
			.values(
				['Rent', 'Utilities', 'Dental supplies', 'Laboratory fees', 'Maintenance', 'Transport'].map(
					(name) => ({ name })
				)
			);
	}

	if (await isEmpty(db, vatAndWithHold, 'vat_and_withhold')) {
		// One row, read by every invoice: 15% VAT and 2% withholding.
		await db.insert(vatAndWithHold).values({ vat: 15, withHold: 2 });
	}

	console.log('Seeded finance reference data.');
}

const SERVICE_CATALOGUE: Record<string, string[]> = {
	Diagnostic: ['Consultation', 'Periapical radiograph', 'Panoramic radiograph'],
	Preventive: ['Scaling and polishing', 'Fluoride application', 'Fissure sealant'],
	Restorative: ['Composite filling', 'Amalgam filling', 'Temporary filling'],
	Surgical: ['Simple extraction', 'Surgical extraction', 'Incision and drainage'],
	Endodontic: ['Root canal — anterior', 'Root canal — molar', 'Pulpotomy'],
	Prosthetic: ['Complete denture', 'Partial denture', 'Crown — metal ceramic']
};

export async function seedServices(db: SeedDb) {
	if (!(await isEmpty(db, serviceCategories, 'service_categories'))) return;

	for (const [categoryName, names] of Object.entries(SERVICE_CATALOGUE)) {
		await db.insert(serviceCategories).values({ name: categoryName });
		const [{ id: categoryId }] = await db
			.select({ id: serviceCategories.id })
			.from(serviceCategories)
			.where(eq(serviceCategories.name, categoryName));

		await db.insert(services).values(names.map((name) => ({ name, categoryId })));
	}

	console.log('Seeded service categories and services.');
}
