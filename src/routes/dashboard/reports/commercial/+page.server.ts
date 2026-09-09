import type { PageServerLoad } from './$types';
import { loadReport } from '../report.server';
import { commercialStats } from '../analytics/commercial.server';

export const load: PageServerLoad = ({ url }) => loadReport(url, 'Commercial', commercialStats);
