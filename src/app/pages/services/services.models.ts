/**
 * Servisler ekranı (E3-02) API tipleri.
 *
 * Backend sözleşmesi:
 *   GET  /api/v1/services?active=&frequency=&q=&page=&size=&sort=  →  PagedResponse<ServiceResponse>
 *   POST /api/v1/services                                          →  ServiceResponse (201)
 *   PUT  /api/v1/services/{id}                                     →  ServiceResponse
 *   PATCH /api/v1/services/{id}/active                             →  ServiceResponse
 *   GET  /api/v1/cards                                             →  CardRef[]
 *
 * Enum değerleri backend enum'larıyla birebir (ActiveState/Frequency/InvoiceSource).
 */

export type ActiveState = 'YES' | 'NO' | 'UNCERTAIN';

export type Frequency = 'MONTHLY' | 'YEARLY' | 'USAGE_BASED' | 'AD_HOC';

export type InvoiceSource =
  | 'SERVICE_PANEL'
  | 'EMAIL'
  | 'E_INVOICE'
  | 'DRIVE_WAITING';

export interface ServiceContact {
  email: string;
  source: string | null;
  primary: boolean;
}

export interface ServiceContactRequest {
  email: string;
  source?: string | null;
  primary?: boolean;
}

export interface ServiceResponse {
  id: number;
  name: string;
  providerName: string | null;
  cardLast4: string | null;
  usingTeamName: string | null;
  frequency: Frequency | null;
  activeState: ActiveState | null;
  activeMonths: string | null;
  approxAmountTry: number | null;
  informational: boolean;
  invoiceSource: InvoiceSource | null;
  purpose: string | null;
  notes: string | null;
  contacts: ServiceContact[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ServiceRequest {
  name: string;
  providerName?: string | null;
  cardLast4?: string | null;
  frequency?: Frequency | null;
  activeState?: ActiveState | null;
  activeMonths?: string | null;
  approxAmountTry?: number | null;
  informational?: boolean | null;
  invoiceSource?: InvoiceSource | null;
  purpose?: string | null;
  notes?: string | null;
  contacts: ServiceContactRequest[];
}

export interface CardRef {
  id: number;
  last4: string;
  bank: string;
  holder: string | null;
  label: string | null;
}

/** Standart sayfalı yanıt zarfı (backend PagedResponse aynası). */
export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  sort: string;
}

// ---- Türkçe etiketler (UI gösterimi) -------------------------------------

export const ACTIVE_STATE_LABELS_TR: Record<ActiveState, string> = {
  YES: 'Evet',
  NO: 'Hayır',
  UNCERTAIN: 'Belirsiz',
};

export const FREQUENCY_LABELS_TR: Record<Frequency, string> = {
  MONTHLY: 'Aylık',
  YEARLY: 'Yıllık',
  USAGE_BASED: 'Kullanım bazlı',
  AD_HOC: 'Ad-hoc',
};

export const INVOICE_SOURCE_LABELS_TR: Record<InvoiceSource, string> = {
  SERVICE_PANEL: 'Servis paneli',
  EMAIL: 'E-posta',
  E_INVOICE: 'e-Fatura',
  DRIVE_WAITING: 'Drive waiting',
};

export const ACTIVE_STATE_OPTIONS: ActiveState[] = ['YES', 'NO', 'UNCERTAIN'];
export const FREQUENCY_OPTIONS: Frequency[] = [
  'MONTHLY',
  'YEARLY',
  'USAGE_BASED',
  'AD_HOC',
];
export const INVOICE_SOURCE_OPTIONS: InvoiceSource[] = [
  'SERVICE_PANEL',
  'EMAIL',
  'E_INVOICE',
  'DRIVE_WAITING',
];
