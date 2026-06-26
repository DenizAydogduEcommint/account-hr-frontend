import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MissingInvoiceRow } from './missing-invoices.models';

/**
 * Eksik Fatura ekranı (E3-04) veri servisi. Bearer token auth interceptor tarafından
 * otomatik eklenir; 401'de interceptor logout eder. Servis ↔ ay çapraz doğrulamasının
 * sonucunu (eksik servis satırları) getirir.
 */
@Injectable({ providedIn: 'root' })
export class MissingInvoicesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Seçili ayda faturası eksik servisleri getirir. */
  list(month: string): Observable<MissingInvoiceRow[]> {
    const params = new HttpParams().set('month', month);
    return this.http.get<MissingInvoiceRow[]>(
      `${this.baseUrl}/missing-invoices`,
      { params },
    );
  }
}
