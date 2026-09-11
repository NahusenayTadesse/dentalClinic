export const bgGradient = `
  bg-gradient-to-b from-[#E0EAFC] to-white text-foreground dark:bg-gradient-to-br dark:from-gray-800 dark:to-black`;
export const selectItem = `hover:bg-gray-100 hover:shadow-md hover:scale-101 duration-300 transition-all ease-in-out dark:hover:bg-gray-900`;
export const toastmsg = `fixed right-4 bottom-20 lg:bottom-4 z-50
             flex items-center gap-3
             bg-green-600 text-white font-medium
             px-5 py-3 rounded-xl shadow-lg
             animate-slide-in`;
export const errormsg = `${toastmsg} !bg-red-600`;
export const searchableFields = [
	'name',
	'description',
	'permissions',
	'value',
	'firstName',
	'lastName',
	'phone',
	'date',
	'time',
	'bookedBy',
	'notes',
	'bookedAt',
	'customerName',
	'date',
	'time'
];

export type Item = {
	value: string | number;
	name: string;
};

export const dropdownClass = `flex capitalize flex-row gap-2 ${selectItem}`;

export const gender = [
	{ value: 'male', name: 'Male' },
	{ value: 'female', name: 'Female' }
];

export function minutesToHoursString(minutes: number) {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${h}h ${m}m`;
}

import { sql } from 'drizzle-orm';
import type { MySqlColumn } from 'drizzle-orm/mysql-core';
import { SvelteDate } from 'svelte/reactivity';

/**
 * A random, unguessable name for an uploaded file.
 *
 * Was `generateUserId`, and did name users until better-auth took over creating them — the only
 * caller left is `saveUploadedFile`. The name matters more than it looks: `/dashboard/files/[name]`
 * checks only that the caller is signed in, so the 122 bits of entropy here are what stop one
 * patient's records being found by guessing at another's filename.
 */
export function generateFileName() {
	return crypto.randomUUID();
}

/**
 * The URL that serves a stored file.
 *
 * **The one place the shape of that URL is written down** (CLAUDE.md §10). It was hand-built as
 * `/dashboard/files/${name}` in twenty-eight places, which is twenty-eight edits the day the
 * store stops being a directory on the server — and the one that gets missed renders a broken
 * image rather than an error.
 *
 * Lives here rather than in `server/files.ts` because most callers are components: an `img src`
 * or an `href`, evaluated in the browser. `server/files.ts` owns the *bytes* and cannot be
 * imported from the client at all.
 *
 * The seam holds for a remote store even if that store needs signed URLs, because this keeps
 * returning an app-relative path and `/dashboard/files/[name]` becomes a redirect to the signed
 * one. So a move to Cloudinary or Supabase Storage changes `server/files.ts` and that route —
 * and touches this function only if the URLs turn out to be public, in which case it returns
 * them directly and saves the hop.
 *
 * Returns `''` for a missing name. Callers already guard with `{#if}`; before this existed they
 * rendered `/dashboard/files/undefined` when they forgot, which is a request that 404s.
 */
export function fileUrl(name: string | null | undefined): string {
	return name ? `/dashboard/files/${encodeURIComponent(name)}` : '';
}

/**
 * Weekday name for a `staff_schedule.week_day` index.
 *
 * 0 is Monday, not Sunday — the schedule table stores a working week, and both schedule
 * components already assumed that. Kept here because they had a byte-identical copy each.
 */
export function getWeekdayName(dayIndex: number): string {
	const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

	if (dayIndex < 0 || dayIndex > 6) {
		throw new Error('Invalid day index. Please provide a number between 0 and 6.');
	}

	return days[dayIndex];
}

export function extractUsername(email: string) {
	if (typeof email !== 'string') {
		throw new Error('Input must be a string');
	}

	// Find the part before the '@'
	const atIndex = email.indexOf('@');

	if (atIndex === -1) {
		throw new Error("Invalid email address: missing '@'");
	}

	return email.substring(0, atIndex);
}

export function getCurrentMonthRange(): string {
	const today = new SvelteDate();

	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, '0');
	const day = String(today.getDate()).padStart(2, '0');

	const firstOfMonth = `${year}-${month}-01`;
	const todayStr = `${year}-${month}-${day}`;

	return `${firstOfMonth}-${todayStr}`;
}

export const currentMonthFilter = (dateField: MySqlColumn, start?: string, end?: string) => {
	// If start/end are passed, return BETWEEN condition
	if (start && end) {
		const endOfDay = new SvelteDate(end);
		endOfDay.setHours(23, 59, 59, 999);

		return sql`${dateField} BETWEEN ${start} AND ${endOfDay}`;
	}

	// Otherwise fallback to current-month logic
	const currentYear = new SvelteDate().getFullYear();
	const currentMonth = new SvelteDate().getMonth() + 1;

	return sql`
    EXTRACT(YEAR FROM ${dateField}) = ${currentYear}
    AND EXTRACT(MONTH FROM ${dateField}) = ${currentMonth}
  `;
};

export function isMobile() {
	if (typeof window === 'undefined') return false; // SSR guard
	return window.innerWidth <= 768;
}

import crypto from 'crypto';

export function generatePassword(
	length: number = 8,
	options = {
		lowercase: true,
		uppercase: true,
		numbers: true,
		symbols: true
	}
): string {
	const lowers = 'abcdefghijklmnopqrstuvwxyz';
	const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const nums = '0123456789';
	const syms = '!@#$%^&*()-_=+[]{};:,.<>/?';

	let chars = '';
	if (options.lowercase) chars += lowers;
	if (options.uppercase) chars += uppers;
	if (options.numbers) chars += nums;
	if (options.symbols) chars += syms;

	if (!chars) throw new Error('No character sets selected!');

	let password = '';
	const charArray = chars.split('');

	for (let i = 0; i < length; i++) {
		const randomIndex = crypto.randomInt(0, charArray.length);
		password += charArray[randomIndex];
	}

	return password;
}

export const formatEthiopianDate = (date: Date | null | undefined): string => {
	// 1. Handle null, undefined, or empty values immediately
	if (!date) return '';

	try {
		// 2. Check if the date is actually valid (prevents "Invalid Date" errors)
		if (isNaN(date.getTime())) {
			return 'No Date Provided';
		}

		const formatter = new Intl.DateTimeFormat('am-ET', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			calendar: 'ethiopic'
		});

		return formatter.format(date);
	} catch (error) {
		// 3. Catch-all for browser compatibility issues or unexpected inputs
		return 'Error Formatting Date';
	}
};
export const formatEthiopianYearMonth = (
	year: number | null | undefined,
	month: number | null | undefined // Strictly 1–12 now
): string => {
	// 1. Basic validation: Ensure we have numbers
	if (year === null || year === undefined || month === null || month === undefined) {
		return '';
	}

	// 2. ERP Rule: Strictly months 1-12 (Skip Pagumē)
	if (month < 1 || month > 12) {
		return 'Invalid Month';
	}

	try {
		// `months` (below) is the one list, and it is the one the schema's `month` enums
		// agree with. This used to keep a second copy here, which drifted: it spelled
		// months 3 and 4 ኅዳር and ታኅሣሥ, so a route built from it matched no stored row.
		const monthName = months[month - 1];

		// Constructs exactly "ግንቦት_2018" with the underscore your routes expect
		const formattedString = `${monthName}_${year}`;

		// Encodes it safely for HTTP Redirect Headers (e.g., %E1%8A%A2...)
		return encodeURIComponent(formattedString);
	} catch (e) {
		return 'Formatting Error';
	}
};

/**
 * A Gregorian `Date` as an Ethiopian year and month.
 *
 * `Intl` with the `ethiopic` calendar does the conversion. The arithmetic is not
 * worth hand-rolling: the Ethiopian new year falls on 11 September, or 12
 * September in the year before a Gregorian leap year, so the offset from the
 * Gregorian year is either 7 or 8 depending on where in the year you are.
 *
 * Callers used to pass `new Date().getFullYear()` and `new Date().getMonth() + 1`
 * straight into `formatEthiopianYearMonth`, which reads its arguments as an
 * Ethiopian year and an Ethiopian month index. Both were wrong: in September 2026
 * that produced `ሰኔ_2026` where the answer is `ነሐሴ_2018`.
 *
 * Pagumē — the five or six day thirteenth month — comes back from `Intl` as month
 * 13, but it is not a period anything here bills or pays against; every `month`
 * enum in the schema stops at ነሐሴ. Those days clamp to month 12 so a page opened
 * during Pagumē lands on the last real month instead of on nothing.
 */
export const getEthiopianYearMonth = (
	date: Date | null | undefined
): { year: number; month: number } | null => {
	if (!date || isNaN(date.getTime())) return null;

	try {
		const parts = new Intl.DateTimeFormat('en-u-ca-ethiopic', {
			year: 'numeric',
			month: 'numeric'
		}).formatToParts(date);

		// The era part ("AM") rides along in the year value in some runtimes, so keep
		// only the digits rather than trusting the whole string to parse.
		const year = Number(parts.find((p) => p.type === 'year')?.value.replace(/\D/g, ''));
		const month = Number(parts.find((p) => p.type === 'month')?.value.replace(/\D/g, ''));

		if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1) return null;

		return { year, month: Math.min(month, 12) };
	} catch (e) {
		return null;
	}
};

/**
 * The `<month>_<year>` segment for the month `date` falls in, ready to drop into a
 * route. This is what the "no range given" redirects want — they land the user on
 * the current period instead of on a month derived from Gregorian numbers.
 *
 * Returns '' if the date cannot be converted, which callers should treat as "do
 * not redirect" rather than pasting an empty segment into a URL.
 */
export const currentEthiopianMonthParam = (date: Date = new Date()): string => {
	const ethiopian = getEthiopianYearMonth(date);
	if (!ethiopian) return '';
	return formatEthiopianYearMonth(ethiopian.year, ethiopian.month);
};

export const formatEthiopianYear = (date: Date | null | undefined): string => {
	if (!date || isNaN(date.getTime())) return '';

	try {
		const formatter = new Intl.DateTimeFormat('am-ET', {
			year: 'numeric',
			calendar: 'ethiopic'
		});

		return formatter.format(date);
	} catch (e) {
		return '';
	}
};

export const getEthiopianYearInt = (date: Date | null | undefined): number | null => {
	if (!date || isNaN(date.getTime())) return null;

	try {
		const formatter = new Intl.DateTimeFormat('en-u-ca-ethiopic', {
			year: 'numeric'
		});

		// Formats to something like "2018 ERA1" or "2018"
		const formatted = formatter.format(date);

		// Extract only the digits
		const yearMatch = formatted.match(/\d+/);
		return yearMatch ? parseInt(yearMatch[0], 10) : null;
	} catch (e) {
		return null;
	}
};
export function formatETB(amount: number | null | undefined, useAmharic: boolean = false): string {
	// Handle null/undefined/NaN amount
	if (amount === null || amount === undefined || isNaN(amount)) {
		return useAmharic ? 'ብር 0.00' : 'ETB 0.00';
	}

	try {
		const locale = useAmharic ? 'am-ET' : 'en-ET';

		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency: 'ETB',
			currencyDisplay: 'symbol',
			minimumFractionDigits: 2
		}).format(amount);
	} catch (e) {
		// Fallback if Intl fails
		return `${amount.toFixed(2)} ETB`;
	}
}

export const getGregorianRangeFromEthiopian = (ethMonth: number, ethYear: number) => {
	// 1. Ethiopian months 1-12 have 30 days. Month 13 has 5 or 6.
	const startDay = 1;
	const endDay = ethMonth === 13 ? (isEthiopianLeapYear(ethYear) ? 6 : 5) : 30;

	// 2. Approximate the Gregorian year (Ethiopian year + ~7/8 years)
	const approxGregYear = ethYear + 8;

	const findGregorian = (eYear: number, eMonth: number, eDay: number) => {
		// Start searching around the approximate Gregorian date
		const date = new Date(approxGregYear, 0, 1);

		// Use a brute-force search within a small window or a known offset
		// For simplicity and accuracy across environments:
		const jdn = ethiopianToJDN(eYear, eMonth, eDay);
		return jdnToGregorian(jdn);
	};

	return {
		start: findGregorian(ethYear, ethMonth, startDay),
		end: findGregorian(ethYear, ethMonth, endDay)
	};
};

// Helper: Check for Ethiopian Leap Year
const isEthiopianLeapYear = (year: number) => (year + 1) % 4 === 0;

// Helper: Convert Ethiopian to Julian Day Number (JDN)
function ethiopianToJDN(year: number, month: number, day: number): number {
	const ERA = 1723856;
	return ERA + (year - 1) * 365 + Math.floor(year / 4) + (month - 1) * 30 + day - 1;
}

// Helper: Convert JDN back to Gregorian Date object
function jdnToGregorian(jdn: number): Date {
	const z = jdn + 0.5;
	const f = Math.floor(z);
	let a = f;
	if (f >= 2299161) {
		const alpha = Math.floor((f - 1867216.25) / 36524.25);
		a = f + 1 + alpha - Math.floor(alpha / 4);
	}
	const b = a + 1524;
	const c = Math.floor((b - 122.1) / 365.25);
	const d = Math.floor(365.25 * c);
	const e = Math.floor((b - d) / 30.6001);
	const day = b - d - Math.floor(30.6001 * e);
	const month = e < 14 ? e - 1 : e - 13;
	const year = month > 2 ? c - 4716 : c - 4715;

	return new Date(year, month - 1, day);
}

import { toGregorian, toEthiopian } from 'ethiopian-calendar-new';

export function ethiopianRange(month: number, year: number) {
	if (month === 13) {
		return {
			startDate: toGregorian(year, month, 1),
			endDate: toGregorian(year, month, 5)
		};
	}

	return {
		startDate: toGregorian(year, month, 1),
		endDate: toGregorian(year, month, 30)
	};
}

const months = [
	'መስከረም',
	'ጥቅምት',
	'ህዳር',
	'ታህሳስ',
	'ጥር',
	'የካቲት',
	'መጋቢት',
	'ሚያዝያ',
	'ግንቦት',
	'ሰኔ',
	'ሐምሌ',
	'ነሐሴ'
];

/**
 * Returns the 1-based index of the Ethiopian month.
 * @param {string} monthName - The name of the month in Ethiopic script.
 * @returns {number|string} - The month number or an error message.
 */
export function getMonthNumber(monthName: string): number {
	// .indexOf finds the position (0-11)
	const index = months.indexOf(monthName.trim());

	// If index is -1, the month wasn't found
	if (index === -1) {
		return 0;
	}

	return index + 1;
}
