/**
 * E5-02 — Gelen Faturalar (Drive waiting pull) API tipleri.
 *
 * Backend sözleşmesi:
 *   POST /api/v1/incoming/pull          → IncomingPullSummary
 *   GET  /api/v1/incoming?status=...     → IncomingInvoice[]  (en yeni önce)
 *   PATCH /api/v1/incoming/{id}/ignore   → IncomingInvoice    (opsiyonel)
 *
 * Yetki: ADMIN / ACCOUNTING (Bearer auth interceptor tarafından eklenir;
 * backend gerçek yetki kapısıdır).
 */

/** Gelen faturanın kaynağı. */
export type IncomingSource = 'DRIVE_WAITING' | 'MAIL';

/** Gelen faturanın işlenme durumu. */
export type IncomingStatus = 'NEW' | 'MATCHED' | 'IGNORED';

/**
 * Tek bir ham (işlenmemiş) gelen fatura kaydı — backend IncomingInvoice aynası.
 * Alan adları/sırası sunucu serileştirmesiyle birebir.
 */
export interface IncomingInvoice {
  /** Sunucu tarafı kayıt kimliği. */
  id: number;
  /** Kaynak (Drive waiting / e-posta). */
  source: IncomingSource;
  /** Kaynağa özel referans (ör. Drive dosya id'si, mail message-id). */
  sourceRef: string | null;
  /** Dosya adı. */
  fileName: string;
  /** İçerik özeti (duplicate tespiti); gösterimde kullanılmaz. */
  sha256: string | null;
  /** Alınma tarihi — ISO ("YYYY-MM-DD" veya tam zaman damgası). */
  receivedAt: string | null;
  /** İşlenme durumu. */
  status: IncomingStatus;
  /** STORAGE_ROOT'a göreli depolanan dosya yolu (E5-04 kullanır). */
  storedPath: string;
  /** Serbest not (yoksa null). */
  notes: string | null;
}

/**
 * "Drive'dan Çek" özeti — backend IncomingPullSummary aynası.
 *
 * `newInvoices` çekme sonrası listenin tamamı değil, bu çekmede dönen yeni
 * kayıtlardır; ekran her çekmeden sonra listeyi {@link IncomingInvoice} ile
 * yeniden yükler.
 */
export interface IncomingPullSummary {
  /** Kaynaktan çekilen toplam dosya sayısı. */
  pulledCount: number;
  /** Bunlardan yeni (daha önce görülmemiş) kayıt sayısı. */
  newCount: number;
  /** Atlanan (duplicate / zaten mevcut) kayıt sayısı. */
  skippedCount: number;
  /** Bu çekmede dönen yeni gelen fatura kayıtları. */
  newInvoices: IncomingInvoice[];
  /** Kullanıcıya gösterilebilecek özet mesajı. */
  message: string;
}
