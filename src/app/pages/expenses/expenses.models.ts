/**
 * Aylık harcamalar ekranı (E3-03) API tipleri.
 *
 * Backend sözleşmesi:
 *   GET /api/v1/expenses?month=YYYY-MM&card=&status=&q=&page=&size=&sort=
 *     → ExpenseListResponse
 *   GET /api/v1/cards → CardRef[]
 *
 * Para değerleri ham sayı (number) gelir; format ön yüzde (tr-TR) uygulanır.
 * transactionDate ISO "YYYY-MM-DD" gelir; "DD.MM.YYYY" gösterimi ön yüzde yapılır.
 */

import { InvoiceStatus } from '../../shared/status-colors';

export type { InvoiceStatus };

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

/** Tek harcama satırı (Excel ay sheet'inin 12 kolonu). */
export interface ExpenseRow {
  id: number;
  /** ISO "YYYY-MM-DD" veya null (Bekleniyor satırı). */
  transactionDate: string | null;
  serviceName: string | null;
  providerName: string | null;
  amount: number | null;
  currency: string | null;
  amountTry: number | null;
  cardLast4: string | null;
  usingTeam: string | null;
  purpose: string | null;
  accountingEmail: string | null;
  invoiceStatus: InvoiceStatus | null;
  /** Renk hex (# olmadan), ör. "4CAF50". Status null ise null. */
  invoiceColorHex: string | null;
  invoiceNote: string | null;
  /**
   * KDV (E3-11) — sunucu tarafında brüt (amountTry) üzerinden hesaplanır.
   * KDV girilmemişse üçü de null.
   */
  /** KDV oranı (yüzde, ör. 20). null → KDV girilmemiş. */
  kdvRate: number | null;
  /** KDV tutarı (TL). null → KDV girilmemiş. */
  kdvAmountTry: number | null;
  /** Matrah / net tutar (TL) = brüt − KDV. null → KDV girilmemiş. */
  netAmountTry: number | null;
}

/** Aylık harcamalar listeleme yanıtı. */
export interface ExpenseListResponse {
  month: string;
  /** ANA (operasyonel, informational=false) satırlar — sayfalı. */
  main: PagedResponse<ExpenseRow>;
  /** Operasyonel TL toplamı (informational hariç, dönem geneli). */
  operationalTotalTry: number;
  /** Bilgi-amaçlı (Multinet/sigorta/vergi) satırlar — AYRI liste. */
  informationalRows: ExpenseRow[];
  /** Bilgi-amaçlı satırların TL alt toplamı (operasyonel toplama dahil değil). */
  informationalTotalTry: number;
}

/** Kart referansı (dropdown için) — /api/v1/cards. */
export interface CardRef {
  id: number;
  last4: string;
  bank: string;
  holder: string | null;
  label: string | null;
}

/**
 * Backend `FileType` enum'ı (E3-09).
 * Java tarafı yalnızca bu değerleri üretir — JPG/PNG gibi MIME türleri
 * `mimeType` alanında taşınır, burada DEĞİL. Görsel faturalar `RECEIPT`/`OTHER`
 * olarak gelir; önizleme kararı `mimeType` üzerinden verilmelidir.
 */
export type FileType = 'PDF' | 'XML' | 'STATEMENT' | 'RECEIPT' | 'OTHER';

/**
 * Tek fatura dosyası metadata'sı.
 * GET /api/v1/expenses/{expenseId}/files yanıtının elemanı.
 * Fiziksel yol ASLA dışa verilmez — dosya yalnızca {@code id} ile çekilir.
 */
export interface FileMeta {
  id: number;
  fileName: string;
  fileType: FileType;
  mimeType: string;
  sizeBytes: number;
  /** ISO datetime. */
  uploadedAt: string;
  invoiceId: number;
  invoiceStatus: string;
  /** Sunucu içinde önizlenebilir mi (PDF/JPG/PNG/XML). */
  previewable: boolean;
}

/** Durum filtresi seçenekleri (sabit sıra). */
export const STATUS_FILTER_OPTIONS: InvoiceStatus[] = [
  'FOUND',
  'E_INVOICE',
  'EXPECTED',
  'TO_INVESTIGATE',
  'IGNORED',
];
