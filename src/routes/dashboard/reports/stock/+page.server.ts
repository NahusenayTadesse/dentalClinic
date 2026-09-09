import type { PageServerLoad } from './$types';
import { loadReport } from '../report.server';
import { stockStats } from '../analytics/stock.server';

export const load: PageServerLoad = ({ url }) => loadReport(url, 'Stock', stockStats);
