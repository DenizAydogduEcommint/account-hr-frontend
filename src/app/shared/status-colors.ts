/**
 * Fatura durumu renkleri ve Türkçe etiketleri — TEK KAYNAK (TypeScript aynası).
 *
 * SCSS karşılığı: src/styles/_tokens.scss ($status-* ve --status-* token'ları).
 * Backend karşılığı: StatusColors (renkler birebir aynı tutulmalı).
 *
 * Renkler `#` ile başlar; backend/dashboard API'si `#` olmadan döndürür
 * (colorHex: "4CAF50"), bu yüzden grafikte `'#' + colorHex` ile birleştirilir
 * veya doğrudan bu sabit kullanılır.
 */

export type InvoiceStatus =
  | 'FOUND'
  | 'E_INVOICE'
  | 'EXPECTED'
  | 'TO_INVESTIGATE'
  | 'IGNORED';

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  FOUND: '#4CAF50',
  E_INVOICE: '#8BC34A',
  EXPECTED: '#FF4444',
  TO_INVESTIGATE: '#FF9800',
  IGNORED: '#FF9800',
} as const;

export const STATUS_LABELS_TR: Record<InvoiceStatus, string> = {
  FOUND: 'Bulundu',
  E_INVOICE: 'e-Fatura',
  EXPECTED: 'Bekleniyor',
  TO_INVESTIGATE: 'Araştırılacak',
  IGNORED: 'Ignored',
} as const;

/** Sabit durum sırası (grafikte seri/etiket/renk hizalaması için). */
export const STATUS_ORDER: readonly InvoiceStatus[] = [
  'FOUND',
  'E_INVOICE',
  'EXPECTED',
  'TO_INVESTIGATE',
  'IGNORED',
] as const;
