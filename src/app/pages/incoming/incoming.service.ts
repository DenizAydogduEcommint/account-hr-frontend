import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  IncomingInvoice,
  IncomingPullSummary,
  IncomingStatus,
} from './incoming.models';

/**
 * E5-02 — Gelen Faturalar (Drive waiting pull) veri servisi.
 *
 * Bearer token auth interceptor tarafından otomatik eklenir; 401'de interceptor
 * refresh/logout yönetir. Yetki: ADMIN / ACCOUNTING (backend gerçek kapıdır).
 */
@Injectable({ providedIn: 'root' })
export class IncomingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * Drive waiting (ve mail) kaynağından yeni faturaları çeker ve özetini döndürür.
   * Gövde gerekmez; çekme tamamen sunucu tarafında tetiklenir.
   */
  pull(): Observable<IncomingPullSummary> {
    return this.http.post<IncomingPullSummary>(
      `${this.baseUrl}/incoming/pull`,
      {},
    );
  }

  /**
   * Gelen fatura kayıtlarını listeler (en yeni önce). Opsiyonel `status` ile
   * süzülür; verilmezse tümü döner.
   */
  list(status?: IncomingStatus): Observable<IncomingInvoice[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<IncomingInvoice[]>(`${this.baseUrl}/incoming`, {
      params,
    });
  }

  /**
   * Bir gelen faturayı "yoksayıldı" (IGNORED) olarak işaretler ve güncel satırı
   * döndürür. (Opsiyonel backend ucu.)
   */
  ignore(id: number): Observable<IncomingInvoice> {
    return this.http.patch<IncomingInvoice>(
      `${this.baseUrl}/incoming/${id}/ignore`,
      {},
    );
  }
}
