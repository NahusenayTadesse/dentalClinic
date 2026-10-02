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
	pensionRate,
	taxType
} from '../../src/lib/server/db/schema/staff';
import { region, city, subcity, address } from '../../src/lib/server/db/schema/locations';
import { serviceCategories, services } from '../../src/lib/server/db/schema/services';
import { condition } from '../../src/lib/server/db/schema/conditions';
import {
	paymentMethods,
	expensesType,
	vatAndWithHold
} from '../../src/lib/server/db/schema/finance';
import { isEmpty, money, type SeedDb } from './util';
import type { ServiceArea } from '../../src/lib/serviceAreas';
import { CURRENT_TAX_BANDS, DEFAULT_PENSION_RATES } from '../../src/lib/server/payrollMath';

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

	// The bands in force (Proclamation 1395/2025), the same list /setup seeds.
	if (await isEmpty(db, taxType, 'tax_type')) {
		await db.insert(taxType).values([...CURRENT_TAX_BANDS]);
	}

	console.log('Seeded HR reference data.');
}

export async function seedFinanceReference(db: SeedDb) {
	// The same defaults /setup seeds; payroll takes a missing share as zero.
	if (await isEmpty(db, pensionRate, 'pension_rate')) {
		await db.insert(pensionRate).values([...DEFAULT_PENSION_RATES]);
	}

	if (await isEmpty(db, paymentMethods, 'payment_methods')) {
		await db.insert(paymentMethods).values(
			// The kind is what billing reads: a cash payment needs the drawer open.
			(
				[
					['Commercial Bank of Ethiopia', 'bank'],
					['Awash Bank', 'bank'],
					['Dashen Bank', 'bank'],
					['Abyssinia Bank', 'bank'],
					['Telebirr', 'mobile'],
					['Cash', 'cash']
				] as const
			).map(([name, kind]) => ({ name, kind }))
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

/**
 * The treatments a small Addis Ababa practice offers, with a fee in birr and what each is charted
 * on (`$lib/serviceAreas.ts`). `null` is a real fee: orthodontics is quoted case by case.
 */
const SERVICE_CATALOGUE: Record<
	string,
	[name: string, price: number | null, area: ServiceArea, removesTooth?: boolean][]
> = {
	Diagnostic: [
		['Consultation', 300, 'mouth'],
		['Periapical radiograph', 200, 'tooth'],
		['Panoramic radiograph', 800, 'mouth']
	],
	Preventive: [
		['Scaling and polishing', 1500, 'mouth'],
		['Fluoride application', 500, 'mouth'],
		['Fissure sealant', 600, 'tooth']
	],
	Restorative: [
		['Composite filling', 2000, 'surface'],
		['Amalgam filling', 1200, 'surface'],
		['Temporary filling', 500, 'tooth']
	],
	Surgical: [
		['Simple extraction', 800, 'tooth', true],
		['Surgical extraction', 3000, 'tooth', true],
		['Incision and drainage', 1000, 'tooth']
	],
	Endodontic: [
		['Root canal — anterior', 5000, 'tooth'],
		['Root canal — molar', 9000, 'tooth'],
		['Pulpotomy', 2500, 'tooth']
	],
	Prosthetic: [
		['Complete denture', 25000, 'mouth'],
		['Partial denture', 12000, 'range'],
		['Crown — metal ceramic', 12000, 'tooth'],
		['Bridge — three unit metal ceramic', 36000, 'range']
	],
	Orthodontic: [['Orthodontic treatment', null, 'mouth']],
	/*
	 * What an examination finds, charted with status `condition`. Services because a procedure
	 * must name one, unpriced because a finding is not a charge: the treatment planned for it
	 * carries the fee.
	 */
	Findings: [
		['Caries', null, 'surface'],
		['Fractured tooth', null, 'tooth'],
		['Periapical lesion', null, 'tooth'],
		['Retained root', null, 'tooth']
	]
};

/**
 * What a finding service diagnoses, for the monthly health return (`services.conditionId`). Only
 * the mappings that are unambiguous: a "Periapical lesion" may be an abscess, a granuloma or a cyst,
 * and a retained root is a state rather than a diagnosis, so both are left for a clinician to link —
 * the return lists them as not counted until someone does.
 */
const FINDING_DIAGNOSES: Record<string, string> = {
	Caries: 'Dental caries',
	'Fractured tooth': 'Dental trauma'
};

/**
 * The catalogue, topped up rather than skipped when it already exists.
 *
 * `price` and `area` arrived after the first seed, so a database seeded before them holds every
 * service as an unpriced whole-mouth treatment: the chart would never ask for a tooth. A category or
 * service that is missing is added, and an existing service gets the catalogue's price and area only
 * while its price is still empty, so a fee somebody has since typed in is never overwritten.
 * `removesTooth` is set on the extractions either way: it is a fact about the treatment, not a
 * choice anybody makes.
 */
export async function seedServices(db: SeedDb) {
	for (const [categoryName, entries] of Object.entries(SERVICE_CATALOGUE)) {
		let [category] = await db
			.select({ id: serviceCategories.id })
			.from(serviceCategories)
			.where(eq(serviceCategories.name, categoryName));
		if (!category) {
			await db.insert(serviceCategories).values({ name: categoryName });
			[category] = await db
				.select({ id: serviceCategories.id })
				.from(serviceCategories)
				.where(eq(serviceCategories.name, categoryName));
		}

		for (const [name, price, area, removesTooth = false] of entries) {
			const [existing] = await db
				.select({ id: services.id, price: services.price })
				.from(services)
				.where(eq(services.name, name));
			if (!existing) {
				await db
					.insert(services)
					.values({ name, categoryId: category.id, price, area, removesTooth });
				continue;
			}
			if (existing.price === null) {
				await db.update(services).set({ price, area }).where(eq(services.id, existing.id));
			}
			if (removesTooth) {
				await db.update(services).set({ removesTooth }).where(eq(services.id, existing.id));
			}
		}
	}

	// Linked only while unlinked, so a choice made on the Services screen is never overwritten.
	for (const [serviceName, conditionName] of Object.entries(FINDING_DIAGNOSES)) {
		const [diagnosis] = await db
			.select({ id: condition.id })
			.from(condition)
			.where(eq(condition.name, conditionName));
		const [service] = await db
			.select({ id: services.id, conditionId: services.conditionId })
			.from(services)
			.where(eq(services.name, serviceName));
		if (diagnosis && service && service.conditionId === null) {
			await db
				.update(services)
				.set({ conditionId: diagnosis.id })
				.where(eq(services.id, service.id));
		}
	}

	console.log('Seeded service categories and services.');
}
