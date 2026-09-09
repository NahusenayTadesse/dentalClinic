import type { SectionGroup } from './sections';

/** How a tile renders its number. */
export type StatFormat = 'money' | 'count' | 'days' | 'hours' | 'percent' | 'years';

export type Stat = {
	key: string;
	label: string;
	value: number;
	format: StatFormat;
	group: SectionGroup;
	/** One line under the number saying what it is counting. */
	hint?: string;
	/** Jumps the detail table to the ledger this number came from. */
	section?: string;
	/** Paints the tile: money coming in is good, money going out is not. */
	tone?: 'positive' | 'negative' | 'neutral' | 'warning';
};

export type ChartSeries = {
	label: string;
	data: number[];
	/** Draws this one series as a line on a bar chart — totals over stacked parts. */
	type?: 'line' | 'bar';
};

export type ChartKind = 'bar' | 'line' | 'area' | 'doughnut' | 'pie' | 'polarArea' | 'radar';

export type ReportChartData = {
	key: string;
	title: string;
	description?: string;
	group: SectionGroup;
	kind: ChartKind;
	labels: string[];
	series: ChartSeries[];
	/** Formats axis ticks and tooltips as currency. */
	money?: boolean;
	stacked?: boolean;
	/** Full-width instead of half-width in the chart grid. */
	wide?: boolean;
};

export type Breakdown = { label: string; value: number };
