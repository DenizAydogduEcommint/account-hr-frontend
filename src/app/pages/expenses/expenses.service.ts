import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ExpenseCreateRequest } from '../../shared/expense-create/expense-create.models';
import { InvoiceStatus } from '../../shared/status-colors';
import {
  CardRef,
  ExpenseListResponse,
  ExpenseRow,
  FileMeta,
} from './expenses.models';

/** Harcama listesi sorgu parametreleri. */
export interface ExpenseQuery {
  month: string;
  card?: string | null;
  status?: InvoiceStatus | null;
  q?: string | null;
  page?: number;
  size?: number;
  sort?: string;
}

/**
 * Aylık harcamalar ekranı (E3-03) veri servisi. Bearer token auth interceptor
 * tarafından otomatik eklenir; 401'de interceptor logout eder.
 */
@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Seçili ay + filtre + arama + sayfalama ile harcamaları getirir. */
  list(query: ExpenseQuery): Observable<ExpenseListResponse> {
    let params = new HttpParams().set('month', query.month);
    if (query.card && query.card.trim()) {
      params = params.set('card', query.card.trim());
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.q && query.q.trim()) {
      params = params.set('q', query.q.trim());
    }
    params = params.set('page', String(query.page ?? 0));
    params = params.set('size', String(query.size ?? 50));
    if (query.sort) {
      params = params.set('sort', query.sort);
    }
    return this.http.get<ExpenseListResponse>(`${this.baseUrl}/expenses`, {
      params,
    });
  }

  /** Kart referans listesini getirir (kart filtresi dropdown'u için). */
  cards(): Observable<CardRef[]> {
    return this.http.get<CardRef[]>(`${this.baseUrl}/cards`);
  }

  /** Takım referans listesini getirir (kullanan takım dropdown'u için). */
  teams(): Observable<{ id: number; name: string }[]> {
    return this.http.get<{ id: number; name: string }[]>(
      `${this.baseUrl}/teams`,
    );
  }

  /**
   * Manuel tek harcama satırı oluşturur (E3-06). Oluşturulan satırı döndürür
   * (liste GET ile aynı şekil). Doğrulama hatası → 400 standart ErrorResponse.
   */
  createExpense(req: ExpenseCreateRequest): Observable<ExpenseRow> {
    return this.http.post<ExpenseRow>(`${this.baseUrl}/expenses`, req);
  }

  /**
   * Tek satırın fatura durumunu değiştirir (E3-07).
   * PATCH /expenses/{id}/status body {@code { status }}.
   * Güncellenmiş satırı (liste GET ile aynı şekil) döndürür — yeni
   * {@code invoiceStatus} + {@code invoiceColorHex} dahil. 400/404 standart
   * ErrorResponse ile döner.
   */
  updateStatus(id: number, status: InvoiceStatus): Observable<ExpenseRow> {
    return this.http.patch<ExpenseRow>(
      `${this.baseUrl}/expenses/${id}/status`,
      { status },
    );
  }

  // ---- Fatura dosyaları (E3-09) ------------------------------------------

  /**
   * Bir harcama satırına ekli fatura dosyalarının metadata listesini getirir.
   * Fiziksel yol dönmez; dosyalar yalnızca {@code id} ile çekilir.
   */
  expenseFiles(expenseId: number): Observable<FileMeta[]> {
    return this.http.get<FileMeta[]>(
      `${this.baseUrl}/expenses/${expenseId}/files`,
    );
  }

  /**
   * Dosyayı önizleme için Blob olarak çeker (Content-Disposition: inline).
   * {@code responseType:'blob'} olduğundan istek XHR ile gider ve auth
   * interceptor Bearer başlığını ekler — bu yüzden URL'i doğrudan bir
   * {@code <iframe src>}/{@code <img src>} içine koymak YETMEZ (o istek JWT
   * taşımaz). Blob alınıp {@code URL.createObjectURL} ile gösterilir.
   */
  previewBlob(fileId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/files/${fileId}/preview`, {
      responseType: 'blob',
    });
  }

  /** Dosyayı indirme (attachment) için Blob olarak çeker. */
  downloadBlob(fileId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/files/${fileId}/download`, {
      responseType: 'blob',
    });
  }
}
