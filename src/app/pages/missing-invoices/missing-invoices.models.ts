/**
 * Eksik Fatura ekranı (E3-04) API tipleri.
 *
 * Backend sözleşmesi:
 *   GET /api/v1/missing-invoices?month=YYYY-MM → MissingInvoiceRow[]
 *
 * "Eksik" = kontrol kümesindeki (Aktif=Evet, bilgi-amaçlı değil; Aylık her ay ya da
 * Yıllık ise yalnızca Aktif Aylar'ında bu ay olan) servisten o ay durumu Bulundu/e-Fatura
 * olan harcama YOK. Bekleniyor (henüz fatura yok) ya da hiç satır olmaması da eksiktir.
 * Para değerleri ham sayı (number) gelir; format ön yüzde (tr-TR) uygulanır.
 */

/** Servis fatura frekansı (backend Frequency enum aynası). */
export type Frequency = 'MONTHLY' | 'YEARLY' | 'USAGE_BASED' | 'AD_HOC';

/** Frekans Türkçe etiketleri (badge için). */
export const FREQUENCY_LABELS_TR: Record<Frequency, string> = {
  MONTHLY: 'Aylık',
  YEARLY: 'Yıllık',
  USAGE_BASED: 'Kullanım bazlı',
  AD_HOC: 'Ad-hoc',
};

/** Bir ayda faturası eksik olan servis satırı. */
export interface MissingInvoiceRow {
  serviceId: number;
  serviceName: string;
  providerName: string | null;
  cardLast4: string | null;
  frequency: Frequency;
  approxAmountTry: number | null;
  contactEmail: string | null;
  activeMonths: string | null;
  /** Servisin herhangi bir harcamada en son görüldüğü ay ("YYYY-MM"); hiç yoksa null. */
  lastSeenMonth: string | null;
}

/**
 * E3-10 wrapper yanıt. Backend artık çıplak liste yerine sayım + yaklaşık TL
 * toplamı ile sarmalanmış yanıt döner:
 *   GET /api/v1/missing-invoices?month=YYYY-MM → MissingInvoiceListResponse
 *
 * Geriye dönük: yanıt hâlâ çıplak dizi gelirse servis bunu `items` say + toplamı
 * `approxAmountTry`'lerden hesaplar (defensive).
 */
export interface MissingInvoiceListResponse {
  items: MissingInvoiceRow[];
  count: number;
  /** Eksik faturaların yaklaşık TL toplamı; null/eksik → 0 say. */
  approxTotalTry: number;
}
