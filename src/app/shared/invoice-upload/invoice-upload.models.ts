/**
 * E3-05 — Fatura yükleme (servis + ay seç, dosya yükle) API tipleri.
 *
 * Backend sözleşmesi:
 *   POST /api/v1/invoices (multipart/form-data)
 *     parts: serviceId (zorunlu), month (YYYY-MM, zorunlu), amount?, currency?,
 *            description?, eInvoice?, kdvRate?, files (1..N)
 *   → 201 InvoiceUploadResponse
 *
 * kdvRate (E3-11): opsiyonel KDV oranı (yüzde, ör. 20). Verilirse matrah (net) ve
 * KDV tutarı brüt tutardan SUNUCU tarafında hesaplanır; verilmezse KDV kaydedilmez.
 */

/** Para birimi (backend Currency enum aynası). */
export type Currency = 'TRY' | 'USD' | 'EUR' | 'GBP';

/** Para birimi seçenekleri (UI sırası). */
export const CURRENCY_OPTIONS: Currency[] = ['TRY', 'USD', 'EUR', 'GBP'];

/** Fatura durumu (yalnızca yükleme sonucu beklenenler). */
export type UploadInvoiceStatus = 'FOUND' | 'E_INVOICE';

/** Yüklenen tek dosyanın özeti (backend StoredFileSummary aynası). */
export interface StoredFileSummary {
  fileAssetId: number;
  fileName: string;
  filePath: string;
  fileType: string;
  sizeBytes: number | null;
}

/** Yükleme sonucu (backend InvoiceUploadResponse aynası). */
export interface InvoiceUploadResponse {
  invoiceId: number;
  expenseId: number;
  status: UploadInvoiceStatus;
  expenseCreated: boolean;
  files: StoredFileSummary[];
}

/** Yükleme isteği parametreleri (frontend formundan toplanır). */
export interface InvoiceUploadRequest {
  serviceId: number;
  month: string;
  amount: number | null;
  currency: Currency | null;
  description: string | null;
  eInvoice: boolean;
  /**
   * KDV oranı (yüzde, ör. 20). null/yok → KDV kaydedilmez. Sunucu bu orandan
   * brüt tutar üzerinden matrah ve KDV tutarını hesaplar (istemci hesaplamaz).
   */
  kdvRate: number | null;
  files: File[];
}

/**
 * E5-03 — Otomatik fatura okuma (parse) yanıtı (backend ParsedInvoiceResponse aynası).
 *
 * Sözleşme: POST /api/v1/invoices/parse (multipart `file`, ADMIN+ACCOUNTING).
 * TÜM alanlar nullable — okunamayan alan null gelir, `warnings` doldurulur.
 * Sadece bilgilendirme/kolaylık amaçlıdır; yükleme akışını bloklamaz.
 */
export interface ParsedInvoiceResponse {
  /** Fatura numarası (okunamazsa null). */
  invoiceNumber: string | null;
  /** Fatura tarihi (YYYY-MM-DD, okunamazsa null). */
  issueDate: string | null;
  /** Brüt toplam tutar (okunamazsa null). */
  totalAmount: number | null;
  /** Para birimi (TRY/USD/EUR/GBP vb.; okunamazsa null). */
  currency: string | null;
  /** KDV tutarı (okunamazsa null). */
  vatAmount: number | null;
  /** KDV oranı (yüzde, ör. 20; okunamazsa null). KDV oranı kontrolünü ön-doldurur. */
  vatRate: number | null;
  /** Fatura kesen sağlayıcı adı (okunamazsa null). */
  providerName: string | null;
  /** Okunamayan/şüpheli alanlar için uyarılar (boş olabilir). */
  warnings: string[];
}

/** Sık kullanılan KDV oranları (yüzde). "Diğer" serbest giriş şablonda eklenir. */
export const COMMON_KDV_RATES = [0, 1, 10, 20];

/** İzin verilen dosya uzantıları (küçük harf, noktasız). */
export const ALLOWED_EXTENSIONS = ['pdf', 'xml', 'jpg', 'jpeg', 'png'];

/** Tek dosya için maksimum boyut (10 MB). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
