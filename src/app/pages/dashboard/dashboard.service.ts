import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DashboardSummary } from './dashboard.models';

/**
 * Dashboard veri servisi.
 *
 * GET /dashboard/summary?month=YYYY-MM — Bearer token auth interceptor
 * tarafından otomatik eklenir.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Seçilen ayın özetini getirir. */
  getSummary(month: string): Observable<DashboardSummary> {
    const params = new HttpParams().set('month', month);
    return this.http.get<DashboardSummary>(`${this.baseUrl}/dashboard/summary`, {
      params,
    });
  }
}
