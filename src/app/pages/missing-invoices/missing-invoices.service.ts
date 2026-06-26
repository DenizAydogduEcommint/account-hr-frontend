import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  MissingInvoiceListResponse,
  MissingInvoiceRow,
} from './missing-invoices.models';

/**
 * Eksik Fatura ekranı (E3-04 / E3-10) veri servisi. Bearer token auth interceptor
 * tarafından otomatik eklenir; 401'de interceptor logout eder. Servis ↔ ay çapraz
 * doğrulamasının sonucunu (eksik servis satırları + yaklaşık TL toplamı) getirir.
 */
@Injectable({ providedIn: 'root' })
export class MissingInvoicesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * Seçili ayda faturası eksik servisleri + yaklaşık TL toplamını getirir.
   *
   * Defensive: backend wrapper döndürürse ({ items, count, approxTotalTry })
   * doğrudan kullanır; hâlâ çıplak dizi gelirse onu `items` sayar ve toplamı
   * satırların `approxAmountTry` değerlerinden hesaplar.
   */
  list(month: string): Observable<MissingInvoiceListResponse> {
    const params = new HttpParams().set('month', month);
    return this.http
      .get<MissingInvoiceListResponse | MissingInvoiceRow[]>(
        `${this.baseUrl}/missing-invoices`,
        { params },
      )
      .pipe(map((resp) => normalizeResponse(resp)));
  }
}

/** Wrapper-veya-dizi yanıtını normalize eder. */
function normalizeResponse(
  resp: MissingInvoiceListResponse | MissingInvoiceRow[],
): MissingInvoiceListResponse {
  if (Array.isArray(resp)) {
    const items = resp;
    const approxTotalTry = items.reduce(
      (acc, r) => acc + (r.approxAmountTry ?? 0),
      0,
    );
    return { items, count: items.length, approxTotalTry };
  }
  const items = resp.items ?? [];
  return {
    items,
    count: resp.count ?? items.length,
    approxTotalTry: resp.approxTotalTry ?? 0,
  };
}
