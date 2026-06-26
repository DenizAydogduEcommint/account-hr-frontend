/**
 * E3-06 — Manuel harcama satırı oluşturma API tipleri.
 *
 * Backend sözleşmesi:
 *   POST /api/v1/expenses
 *     body: ExpenseCreateRequest
 *   → ExpenseRow (liste GET ile aynı şekil)
 *
 * Para değerleri ham sayı (number) gönderilir; tarih ISO "YYYY-MM-DD".
 */

import { Currency } from '../invoice-upload/invoice-upload.models';

export type { Currency };

/** Bilinen kartların son 4 hanesi (Excel'deki üç kart). */
export const KNOWN_CARD_LAST4 = ['3800', '3909', '9164'] as const;

/** Manuel harcama satırı oluşturma isteği (backend ExpenseCreateRequest aynası). */
export interface ExpenseCreateRequest {
  /** Servis master listesinden seçilen servis id'si (zorunlu). */
  serviceId: number;
  /** İşlem tarihi ISO "YYYY-MM-DD" (zorunlu). */
  transactionDate: string;
  /** Orijinal tutar (zorunlu, > 0). */
  amount: number;
  /** Para birimi (zorunlu). */
  currency: Currency;
  /** TL karşılığı (zorunlu, > 0). */
  amountTry: number;
  /** Kart son 4 hane (opsiyonel; boşsa servisin kartı kullanılır). */
  cardLast4?: string | null;
  /** Kullanan takım id'si (opsiyonel; takım listesinden seçilir). */
  usingTeamId?: number | null;
  /** Amaç / açıklama (opsiyonel). */
  purpose?: string | null;
  /** Bilgi amaçlı satır mı (opsiyonel, varsayılan false). */
  informational?: boolean;
}
