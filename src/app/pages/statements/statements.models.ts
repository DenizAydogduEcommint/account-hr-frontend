/**
 * E4-01 — Banka ekstresi yükleme (parse önizle + onayla) API tipleri.
 *
 * Backend sözleşmesi:
 *   POST /api/v1/statements (multipart/form-data)
 *     parts: file (zorunlu), cardLast4 (zorunlu), month (YYYY-MM, zorunlu)
 *     → StatementUploadResponse  (parse ÖNİZLEMESİ — henüz kalıcı kayıt yok)
 *   POST /api/v1/statements/confirm (application/json)
 *     body: { batchRef }
 *     → StatementConfirmResponse
 *
 * Yetki: ADMIN / ACCOUNTING (Bearer auth interceptor tarafından eklenir).
 *
 * NOT: Parser şu an sunucu tarafında placeholder; çoğu zaman boş `transactions`
 * + açıklayıcı bir uyarı döner ("örnek bekleniyor"). UI bu durumu kırılmadan
 * (boş-durum + uyarı paneli) gösterir ve tam akışı yine de sergiler.
 */

/**
 * Parse edilmiş tek ekstre hareketi (önizleme satırı).
 * Backend StatementTxnDto aynası — alan adları/sırası sunucu serileştirmesiyle birebir.
 */
export interface ParsedTxn {
  /** Sunucu tarafı kayıt kimliği (önizleme partisinde atanır). */
  id: number;
  /** İşlem tarihi — ISO "YYYY-MM-DD" (gösterimde "DD.MM.YYYY"). */
  transactionDate: string | null;
  /** Ham açıklama / işyeri metni. */
  description: string | null;
  /** Orijinal tutar (döviz cinsinden) — ham sayı. */
  amount: number | null;
  /** Para birimi (TRY/USD/EUR/...). */
  currency: string | null;
  /** TL karşılığı — ham sayı. */
  amountTry: number | null;
  /** Hareketin durumu (ör. "Bekleniyor"/"Bulundu"/...). */
  status: string;
  /** Bu hareket mevcut bir kayıtla eşleşti mi. */
  matched: boolean;
  /** Parse sırasında bu satıra özel uyarı (yoksa null). */
  parseWarning: string | null;
  /** Ekstreden okunan ham satır metni (eşleştirme/teşhis için). */
  rawText: string | null;
}

/**
 * Ekstre yükleme (parse önizleme) yanıtı — backend StatementUploadResponse aynası.
 *
 * `batchRef` onay isteğinde geri gönderilir (hangi parse partisinin
 * onaylanacağını açıkça taşır — "en son" varsayımına güvenilmez).
 */
export interface StatementUploadResponse {
  /** Bu parse partisinin referansı; onayda geri gönderilir. */
  batchRef: string;
  /** Sunucunun normalize ettiği kart (son 4 hane). */
  card: string;
  /** Sunucunun normalize ettiği ay ("YYYY-MM"). */
  month: string;
  /** Parse edilen hareketler (placeholder parser'da çoğunlukla boş). */
  transactions: ParsedTxn[];
  /** Kullanıcıya gösterilecek uyarılar (parser placeholder mesajı dahil). */
  warnings: string[];
  /** Bu ekstre (kart+ay) daha önce yüklenmiş mi. */
  alreadyUploaded: boolean;
}

/** Onay yanıtı — backend StatementConfirmResponse aynası. */
export interface StatementConfirmResponse {
  /** Kalıcı olarak yazılan hareket sayısı. */
  confirmed: number;
}

/** İzin verilen ekstre dosya uzantıları (küçük harf, noktasız). */
export const STATEMENT_ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'docx'];

/** Tek ekstre dosyası için maksimum boyut (10 MB). */
export const STATEMENT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
