/**
 * Dashboard API tipleri.
 *
 * Backend sözleşmesi (E3-01):
 *   GET /api/v1/dashboard/summary?month=YYYY-MM  →  DashboardSummary
 *
 * Not: statusCounts HER ZAMAN 5 durumu da içerir. colorHex `#` İÇERMEZ
 * (ör. "4CAF50"). Boş ay → totalTry 0 ve tüm sayımlar 0.
 */

import { InvoiceStatus } from '../../shared/status-colors';

export type { InvoiceStatus };

export interface StatusCount {
  status: InvoiceStatus;
  count: number;
  /** Renk kodu, `#` olmadan (ör. "4CAF50"). */
  colorHex: string;
}

export interface DashboardSummary {
  month: string; // "YYYY-MM"
  totalTry: number;
  statusCounts: StatusCount[];
  missingCount: number;
  foundCount: number;
  investigateCount: number;
  expenseCount: number;
}
