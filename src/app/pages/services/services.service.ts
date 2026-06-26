import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ActiveState,
  CardRef,
  Frequency,
  PagedResponse,
  ServiceRequest,
  ServiceResponse,
} from './services.models';

/** Liste sorgu parametreleri. */
export interface ServiceQuery {
  active?: ActiveState | null;
  frequency?: Frequency | null;
  q?: string | null;
  page?: number;
  size?: number;
  sort?: string;
}

/**
 * Servisler ekranı (E3-02) veri servisi. Bearer token auth interceptor tarafından
 * otomatik eklenir; 401'de interceptor logout eder.
 */
@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Filtre + arama + sayfalama ile servisleri getirir. */
  list(query: ServiceQuery): Observable<PagedResponse<ServiceResponse>> {
    let params = new HttpParams();
    if (query.active) {
      params = params.set('active', query.active);
    }
    if (query.frequency) {
      params = params.set('frequency', query.frequency);
    }
    if (query.q && query.q.trim()) {
      params = params.set('q', query.q.trim());
    }
    params = params.set('page', String(query.page ?? 0));
    params = params.set('size', String(query.size ?? 50));
    params = params.set('sort', query.sort ?? 'name,asc');
    return this.http.get<PagedResponse<ServiceResponse>>(
      `${this.baseUrl}/services`,
      { params },
    );
  }

  /** Yeni servis oluşturur (ADMIN). */
  create(body: ServiceRequest): Observable<ServiceResponse> {
    return this.http.post<ServiceResponse>(`${this.baseUrl}/services`, body);
  }

  /** Mevcut servisi günceller (ADMIN). */
  update(id: number, body: ServiceRequest): Observable<ServiceResponse> {
    return this.http.put<ServiceResponse>(`${this.baseUrl}/services/${id}`, body);
  }

  /** Servisi aktif/pasif yapar (ADMIN) — sert silme yerine. */
  setActive(id: number, activeState: ActiveState): Observable<ServiceResponse> {
    return this.http.patch<ServiceResponse>(
      `${this.baseUrl}/services/${id}/active`,
      { activeState },
    );
  }

  /** Kart referans listesini getirir (dropdown için). */
  cards(): Observable<CardRef[]> {
    return this.http.get<CardRef[]>(`${this.baseUrl}/cards`);
  }
}
