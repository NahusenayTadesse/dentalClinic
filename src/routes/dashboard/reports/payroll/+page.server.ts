import type { PageServerLoad } from './$types';
import { loadReport } from '../report.server';
import { payrollStats } from '../analytics/payroll.server';

export const load: PageServerLoad = ({ url }) => loadReport(url, 'Payroll', payrollStats);
