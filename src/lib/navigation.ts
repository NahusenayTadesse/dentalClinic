/**
 * The app's menu, as data: what the sidebar draws and what the search palette offers.
 *
 * **One list, two readers.** The sidebar and `Search.svelte` used to keep their own lists of the
 * same routes, and they drifted in both directions. The palette offered `/dashboard/services`,
 * `/dashboard/salary/pensions` and `/dashboard/salary/tax-types`, none of which exist. The sidebar
 * offered `/dashboard/reports/commercial`, a report pruned with the facilities features. Neither
 * list showed the clinic's own reference screens (allergens, chairs, closures and eight more), so
 * those were reachable only by typing the address. Both now read from here, and
 * `navigation.test.ts` fails on any link that is not a page.
 *
 * **No permissions here.** Each reader filters with `canVisit(url, permList)`, the same rule the
 * server gate applies to that URL, so a menu entry cannot disagree with the gate in front of it.
 * Hiding an entry is courtesy; the gate is the control (CLAUDE.md §9).
 *
 * Non-goals: ordering by usage, per-role menus, or anything that makes the menu differ between
 * two people with the same permissions.
 */
import type { Component } from 'svelte';
import type { IconProps } from '@lucide/svelte';

import Activity from '@lucide/svelte/icons/activity';
import Armchair from '@lucide/svelte/icons/armchair';
import Award from '@lucide/svelte/icons/award';
import BadgeCheck from '@lucide/svelte/icons/badge-check';
import Banknote from '@lucide/svelte/icons/banknote';
import BanknoteArrowDown from '@lucide/svelte/icons/banknote-arrow-down';
import BanknoteArrowUp from '@lucide/svelte/icons/banknote-arrow-up';
import Building2 from '@lucide/svelte/icons/building-2';
import CalendarDays from '@lucide/svelte/icons/calendar-days';
import CalendarOff from '@lucide/svelte/icons/calendar-off';
import ChartArea from '@lucide/svelte/icons/chart-area';
import CircleX from '@lucide/svelte/icons/circle-x';
import ClipboardList from '@lucide/svelte/icons/clipboard-list';
import Coins from '@lucide/svelte/icons/coins';
import Contact from '@lucide/svelte/icons/contact';
import Container from '@lucide/svelte/icons/container';
import FileHeart from '@lucide/svelte/icons/file-heart';
import FlaskConical from '@lucide/svelte/icons/flask-conical';
import BellRing from '@lucide/svelte/icons/bell-ring';
import GitBranch from '@lucide/svelte/icons/git-branch';
import GraduationCap from '@lucide/svelte/icons/graduation-cap';
import HeartPulse from '@lucide/svelte/icons/heart-pulse';
import Hospital from '@lucide/svelte/icons/hospital';
import IdCardLanyard from '@lucide/svelte/icons/id-card-lanyard';
import Landmark from '@lucide/svelte/icons/landmark';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import LifeBuoy from '@lucide/svelte/icons/life-buoy';
import List from '@lucide/svelte/icons/list';
import Loader from '@lucide/svelte/icons/loader';
import MapPin from '@lucide/svelte/icons/map-pin';
import Megaphone from '@lucide/svelte/icons/megaphone';
import OctagonMinus from '@lucide/svelte/icons/octagon-minus';
import Phone from '@lucide/svelte/icons/phone';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import FileSignature from '@lucide/svelte/icons/file-signature';
import FolderInput from '@lucide/svelte/icons/folder-input';
import DatabaseBackup from '@lucide/svelte/icons/database-backup';
import MessageSquare from '@lucide/svelte/icons/message-square';
import Smartphone from '@lucide/svelte/icons/smartphone';
import PhoneCall from '@lucide/svelte/icons/phone-call';
import Pill from '@lucide/svelte/icons/pill';
import Plus from '@lucide/svelte/icons/plus';
import ScanLine from '@lucide/svelte/icons/scan-line';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import ShieldAlert from '@lucide/svelte/icons/shield-alert';
import Sheet from '@lucide/svelte/icons/sheet';
import SquareChartGantt from '@lucide/svelte/icons/square-chart-gantt';
import Stethoscope from '@lucide/svelte/icons/stethoscope';
import Tags from '@lucide/svelte/icons/tags';
import TreePalm from '@lucide/svelte/icons/tree-palm';
import UserPlus from '@lucide/svelte/icons/user-plus';
import UserRoundCog from '@lucide/svelte/icons/user-round-cog';
import Users from '@lucide/svelte/icons/users';
import HandCoins from '@lucide/svelte/icons/hand-coins';
import Vault from '@lucide/svelte/icons/vault';

/** One menu entry. A group is an entry with `items`; its own `url` is where the group lives. */
export type NavItem = {
	title: string;
	url: string;
	icon: Component<IconProps>;
	items?: NavItem[];
	/**
	 * Which card of the admin panel's index an admin-panel screen belongs on, when that is not the
	 * sidebar group it sits in. See `SETTINGS_SECTIONS`.
	 */
	section?: SettingsSection;
};

/**
 * The approval queues, by the `key` each has in `APPROVAL_ENTITIES` (`server/approvals.ts`).
 *
 * Spelled here rather than imported because that registry is server-only: it holds the Drizzle
 * tables. `navigation.test.ts` checks the two agree, so a queue added there and not here fails a
 * test instead of quietly having no menu entry, which is how four of the eight were missing.
 */
export const APPROVAL_QUEUES: { key: string; title: string }[] = [
	{ key: 'employees', title: 'Employees' },
	{ key: 'salaries', title: 'Salary Changes' },
	{ key: 'expenses', title: 'Expenses' },
	{ key: 'payroll-runs', title: 'Payroll Runs' },
	{ key: 'payroll-adjustments', title: 'Payroll Adjustments' },
	{ key: 'customers', title: 'Payers' },
	{ key: 'invoices', title: 'Discounts and Voids' },
	{ key: 'refunds', title: 'Refunds' }
];

/** The same queues seen from one side: pending under Approvals, rejected under Rejections. */
function queueItems(base: string, icon: Component<IconProps>): NavItem[] {
	return APPROVAL_QUEUES.map((queue) => ({
		title: queue.title,
		url: `${base}/${queue.key}`,
		icon
	}));
}

export const NAVIGATION: NavItem[] = [
	{ title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },

	{
		title: 'Patients',
		url: '/dashboard/patients',
		icon: HeartPulse,
		items: [
			{ title: 'All Patients', url: '/dashboard/patients', icon: List },
			{ title: 'Register a Patient', url: '/dashboard/patients/add', icon: UserPlus },
			{ title: 'Plan Follow-up', url: '/dashboard/treatment-plans', icon: PhoneCall },
			{ title: 'Radiograph Inbox', url: '/dashboard/patients/radiographs', icon: FolderInput }
		]
	},

	{
		title: 'Appointments',
		url: '/dashboard/appointments',
		icon: CalendarDays,
		items: [
			{ title: 'Day View', url: '/dashboard/appointments', icon: CalendarDays },
			{ title: 'Appointment List', url: '/dashboard/appointments/list', icon: List },
			{ title: 'Reminders', url: '/dashboard/appointments/reminders', icon: Phone },
			{ title: 'Recalls', url: '/dashboard/recalls', icon: BellRing },
			{ title: 'Lab Work', url: '/dashboard/lab-cases', icon: FlaskConical },
			{ title: 'Sterilisation', url: '/dashboard/sterilisation', icon: ShieldCheck },
			{ title: 'Dentists', url: '/dashboard/providers', icon: Stethoscope }
		]
	},

	{
		title: 'Billing',
		url: '/dashboard/billing',
		icon: HandCoins,
		items: [
			{ title: 'Who Owes', url: '/dashboard/billing', icon: HandCoins },
			{ title: 'Cash Drawer', url: '/dashboard/billing/cash', icon: Vault },
			{ title: 'Mobile Money', url: '/dashboard/billing/mobile', icon: Smartphone }
		]
	},

	{
		title: 'Approvals',
		url: '/dashboard/approvals',
		icon: BadgeCheck,
		items: [
			{ title: 'All Queues', url: '/dashboard/approvals', icon: BadgeCheck },
			...queueItems('/dashboard/approvals', Loader)
		]
	},

	{
		title: 'Rejections',
		url: '/dashboard/rejections',
		icon: OctagonMinus,
		items: [
			{ title: 'All Queues', url: '/dashboard/rejections', icon: OctagonMinus },
			...queueItems('/dashboard/rejections', CircleX)
		]
	},

	{
		title: 'Payers',
		url: '/dashboard/customers',
		icon: Users,
		items: [
			{ title: 'All Payers', url: '/dashboard/customers', icon: List },
			{ title: 'Add a Payer', url: '/dashboard/customers/add-customer', icon: Plus }
		]
	},

	{
		title: 'Employees',
		url: '/dashboard/employees',
		icon: IdCardLanyard,
		items: [
			{ title: 'All Active Employees', url: '/dashboard/employees', icon: List },
			{ title: 'Add New Employee', url: '/dashboard/employees/add-employee', icon: Plus },
			{ title: 'Leaves', url: '/dashboard/employees/leaves', icon: TreePalm }
		]
	},

	{
		title: 'Finance',
		url: '/dashboard/salary',
		icon: Banknote,
		items: [
			{ title: 'Paid Salaries', url: '/dashboard/salary/paid-salaries', icon: Banknote },
			{ title: 'All UnPaid Salaries', url: '/dashboard/salary/add-payroll', icon: BanknoteArrowUp },
			{ title: 'Overtime', url: '/dashboard/salary/ledger/overtime', icon: BanknoteArrowUp },
			{ title: 'Bonuses', url: '/dashboard/salary/ledger/bonuses', icon: BanknoteArrowUp },
			{ title: 'Deductions', url: '/dashboard/salary/ledger/deductions', icon: BanknoteArrowDown },
			{ title: 'Transactions', url: '/dashboard/salary/transactions', icon: ScanLine },
			{ title: 'Expenses', url: '/dashboard/salary/transactions/expenses', icon: Coins }
		]
	},

	{
		title: 'Supplies',
		url: '/dashboard/supplies',
		icon: Container,
		items: [
			{ title: 'Stock Levels', url: '/dashboard/supplies', icon: List },
			{ title: 'Add Supply', url: '/dashboard/supplies/add-supplies', icon: Plus },
			{ title: 'Suppliers', url: '/dashboard/supplies/suppliers', icon: Sheet },
			{
				title: 'Add Supplier',
				url: '/dashboard/supplies/suppliers/add-suppliers',
				icon: Plus
			},
			{
				title: 'Supply Types',
				url: '/dashboard/admin-panel/supply-types',
				section: 'stock',
				icon: Tags
			},
			{ title: 'Stock Report', url: '/dashboard/reports/stock', icon: ChartArea }
		]
	},

	{
		title: 'Reports',
		url: '/dashboard/reports',
		icon: ChartArea,
		items: [
			{ title: 'Overview', url: '/dashboard/reports', icon: LayoutDashboard },
			{ title: 'Clinic', url: '/dashboard/reports/clinic', icon: Stethoscope },
			{ title: 'Health Report (HMIS)', url: '/dashboard/hmis', icon: FileHeart },
			{ title: 'People', url: '/dashboard/reports/people', icon: Users },
			{ title: 'Payroll', url: '/dashboard/reports/payroll', icon: Banknote },
			{ title: 'Compensation', url: '/dashboard/reports/compensation', icon: Coins },
			{ title: 'Time & Leave', url: '/dashboard/reports/leave', icon: TreePalm },
			{ title: 'Stock', url: '/dashboard/reports/stock', icon: Container },
			{ title: 'Money', url: '/dashboard/reports/money', icon: Landmark },
			{ title: 'System', url: '/dashboard/reports/system', icon: ScrollText }
		]
	},

	/*
	 * The clinic's own reference lists, apart from the HR and payroll ones below. They share a
	 * permission (`settings.manage`, via the `/dashboard/admin-panel` prefix) but not an audience:
	 * the person who adds a chair or a medicine is rarely the person who sets pension rates, and
	 * one thirty-entry menu hid both from each of them.
	 */
	{
		title: 'Clinic Setup',
		url: '/dashboard/admin-panel/branches',
		icon: Hospital,
		items: [
			{ title: 'Branches', url: '/dashboard/admin-panel/branches', icon: GitBranch },
			{ title: 'Chairs', url: '/dashboard/admin-panel/chairs', icon: Armchair },
			{ title: 'Closures', url: '/dashboard/admin-panel/closures', icon: CalendarOff },
			{
				title: 'Appointment Types',
				url: '/dashboard/admin-panel/appointment-types',
				icon: ClipboardList
			},
			{ title: 'Services', url: '/dashboard/admin-panel/services', icon: SquareChartGantt },
			{
				title: 'Service Categories',
				url: '/dashboard/admin-panel/services/categories',
				icon: Tags
			},
			{ title: 'Specialties', url: '/dashboard/admin-panel/specialties', icon: Award },
			{ title: 'Dental Labs', url: '/dashboard/admin-panel/dental-labs', icon: FlaskConical },
			{ title: 'Allergens', url: '/dashboard/admin-panel/allergens', icon: ShieldAlert },
			{ title: 'Conditions', url: '/dashboard/admin-panel/conditions', icon: Activity },
			{ title: 'Medicines', url: '/dashboard/admin-panel/medicines', icon: Pill },
			{ title: 'Consent Forms', url: '/dashboard/admin-panel/consent-forms', icon: FileSignature },
			{ title: 'Sterilisers', url: '/dashboard/admin-panel/sterilisers', icon: ShieldCheck },
			{
				title: 'Referral Sources',
				url: '/dashboard/admin-panel/referral-sources',
				icon: Megaphone
			},
			{ title: 'Contact Types', url: '/dashboard/admin-panel/contact-types', icon: Contact }
		]
	},

	{
		title: 'Admin Panel',
		url: '/dashboard/admin-panel',
		icon: UserRoundCog,
		items: [
			{ title: 'Admin Panel', url: '/dashboard/admin-panel', icon: UserRoundCog },
			{ title: 'Users', url: '/dashboard/admin-panel/users', section: 'access', icon: Users },
			{ title: 'Roles', url: '/dashboard/admin-panel/roles', section: 'access', icon: Users },
			{
				title: 'Backups',
				url: '/dashboard/admin-panel/backups',
				section: 'access',
				icon: DatabaseBackup
			},
			{
				title: 'Regions',
				url: '/dashboard/admin-panel/regions',
				section: 'locations',
				icon: MapPin
			},
			{ title: 'Cities', url: '/dashboard/admin-panel/cities', section: 'locations', icon: MapPin },
			{
				title: 'Subcities',
				url: '/dashboard/admin-panel/subcities',
				section: 'locations',
				icon: MapPin
			},
			{
				title: 'Departments',
				url: '/dashboard/admin-panel/department',
				section: 'people',
				icon: Building2
			},
			{
				title: 'Positions',
				url: '/dashboard/admin-panel/positions',
				section: 'people',
				icon: Building2
			},
			{
				title: 'Educational Level',
				url: '/dashboard/admin-panel/educational-level',
				section: 'people',
				icon: GraduationCap
			},
			{
				title: 'Employment Status',
				url: '/dashboard/admin-panel/employment-status',
				section: 'people',
				icon: IdCardLanyard
			},
			{
				title: 'Leave Types',
				url: '/dashboard/admin-panel/leave-types',
				section: 'people',
				icon: TreePalm
			},
			{
				title: 'Annual Leave Entitlements',
				url: '/dashboard/admin-panel/annual-leave-entitlements',
				section: 'people',
				icon: TreePalm
			},
			{
				title: 'Leave Expiry Policy',
				url: '/dashboard/admin-panel/leave-expiry-policy',
				section: 'people',
				icon: TreePalm
			},
			{
				title: 'Run Leave Accrual',
				url: '/dashboard/admin-panel/leave-accrual',
				section: 'people',
				icon: TreePalm
			},
			{
				title: 'Payment Methods',
				url: '/dashboard/admin-panel/payment-methods',
				section: 'money',
				icon: Banknote
			},
			{
				title: 'Billing Settings',
				url: '/dashboard/admin-panel/billing-settings',
				section: 'money',
				icon: Banknote
			},
			{
				title: 'SMS',
				url: '/dashboard/admin-panel/sms',
				section: 'clinic',
				icon: MessageSquare
			},
			{
				title: 'Tax Bands',
				url: '/dashboard/admin-panel/tax-types',
				section: 'money',
				icon: Banknote
			},
			{
				title: 'Overtime Types',
				url: '/dashboard/admin-panel/overtime-types',
				section: 'money',
				icon: Banknote
			},
			{
				title: 'Pension Rates',
				url: '/dashboard/admin-panel/pensions',
				section: 'money',
				icon: BanknoteArrowDown
			},
			{
				title: 'Vat and Withhold',
				url: '/dashboard/admin-panel/vat-withhold',
				section: 'money',
				icon: Coins
			}
		]
	},

	// Ungated, so it survives the permission filter for everyone — the one screen a user with no
	// permissions at all can still reach and read.
	{ title: 'Help', url: '/dashboard/help', icon: LifeBuoy }
];

/** Whether `pathname` is `url` itself or a page beneath it. */
function isUnder(pathname: string, url: string): boolean {
	return pathname === url || pathname.startsWith(url + '/');
}

/**
 * The group the current page belongs to, for highlighting: the one holding the longest link
 * that `pathname` falls under.
 *
 * A prefix test on the group's own URL cannot do this. Clinic Setup, Admin Panel and Supplies
 * all hold pages under `/dashboard/admin-panel`, so on the chairs screen a prefix test lit up
 * Admin Panel; on Supply Types it did the same, under the wrong group. The longest matching
 * child is the most specific claim, so it decides. The dashboard index is matched exactly, or
 * every page would fall under it.
 */
export function activeGroup(items: NavItem[], pathname: string): string | undefined {
	let best: { title: string; length: number } | undefined;

	for (const item of items) {
		for (const link of item.items ?? [item]) {
			const matches =
				link.url === '/dashboard' ? pathname === link.url : isUnder(pathname, link.url);
			if (matches && link.url.length > (best?.length ?? -1)) {
				best = { title: item.title, length: link.url.length };
			}
		}
	}

	return best?.title;
}

/** The cards of the admin panel's index, and the menus above every admin-panel screen. */
export type SettingsSection = 'clinic' | 'people' | 'locations' | 'money' | 'access' | 'stock';

/**
 * The sections, in the order they are shown. The screens in each come from `NAVIGATION` — an
 * admin-panel link's `section`, or `clinic` for everything in the Clinic Setup group — so the
 * admin panel's own menus cannot drift from the sidebar. They did: the index page and the menu
 * bar above it were two more hand-kept lists, which disagreed with each other about Chairs, both
 * lacked Medicines, and both filed allergens and closures under "Finance".
 */
export const SETTINGS_SECTIONS: {
	key: SettingsSection;
	title: string;
	description: string;
	icon: Component<IconProps>;
}[] = [
	{
		key: 'clinic',
		title: 'Clinic setup',
		description:
			'Branches, chairs and closures; the services, medicines and findings the chart offers.',
		icon: Hospital
	},
	{
		key: 'people',
		title: 'People and leave',
		description: 'Departments, positions and the leave rules payroll reads.',
		icon: IdCardLanyard
	},
	{
		key: 'money',
		title: 'Money',
		description: 'Payment methods, taxes, pensions and overtime rates.',
		icon: Banknote
	},
	{
		key: 'locations',
		title: 'Locations',
		description: 'The regions, cities and subcities every address is built from.',
		icon: MapPin
	},
	{
		key: 'stock',
		title: 'Stock',
		description: 'The kinds of supply the clinic keeps.',
		icon: Tags
	},
	{
		key: 'access',
		title: 'Access',
		description: 'Who can sign in, and what each role may do.',
		icon: Users
	}
];

/**
 * The admin-panel screens in each section that the viewer may open, empty sections dropped.
 *
 * `canOpen` is `canVisit` bound to the viewer's permissions — the same rule the server gate
 * applies, so no card or menu offers a screen the click would refuse.
 */
export function settingsSections(canOpen: (url: string) => boolean) {
	const screens = NAVIGATION.flatMap((group) =>
		(group.items ?? [])
			.filter((item) => item.url.startsWith('/dashboard/admin-panel/'))
			.map((item) => ({
				item,
				section: item.section ?? (group.title === 'Clinic Setup' ? 'clinic' : undefined)
			}))
	);

	return SETTINGS_SECTIONS.map((section) => ({
		...section,
		items: screens
			.filter((s) => s.section === section.key && canOpen(s.item.url))
			.map((s) => s.item)
	})).filter((section) => section.items.length > 0);
}

/**
 * Pages worth finding by name that the sidebar leaves out to stay short: each is one click from
 * a page that is in it.
 */
const SEARCH_ONLY: { label: string; url: string }[] = [
	{ label: 'Inactive Employees', url: '/dashboard/employees/inactive' },
	{ label: 'Pending Leaves', url: '/dashboard/employees/leaves/pending' },
	{ label: 'Approved Leaves', url: '/dashboard/employees/leaves/approved' },
	{ label: 'Cancelled Leaves', url: '/dashboard/employees/leaves/cancelled' }
];

/**
 * The menu as a flat list for the search palette, one entry per address, filtered to what the
 * viewer can open.
 *
 * A child is labelled with its group — "Approvals › Refunds", not "Refunds" — because the
 * palette has no tree to give it context, and "All Queues" twice with nothing to tell them apart
 * is what a flat list otherwise produces. Where two entries share an address, the first wins.
 */
export function searchEntries(canOpen: (url: string) => boolean): { label: string; url: string }[] {
	const entries: { label: string; url: string }[] = [];

	for (const item of NAVIGATION) {
		if (!item.items) entries.push({ label: item.title, url: item.url });
		for (const child of item.items ?? []) {
			entries.push({ label: `${item.title} › ${child.title}`, url: child.url });
		}
	}
	entries.push(...SEARCH_ONLY);

	const seen = new Set<string>();
	return entries.filter((entry) => {
		if (seen.has(entry.url) || !canOpen(entry.url)) return false;
		seen.add(entry.url);
		return true;
	});
}
