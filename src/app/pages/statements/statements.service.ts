import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CardRef } from '../expenses/expenses.models';
import {
  StatementConfirmResponse,
  StatementUploadResponse,
} from './statements.models';

/**
 * E4-01 — Banka ekstresi yükleme & onay veri servisi.
 *
 * Bearer token auth interceptor tarafından otomatik eklenir; 401'de interceptor
 * refresh/logout yönetir. Yetki: ADMIN / ACCOUNTING (backend gerçek kapıdır).
 *
 * Akış: {@link upload} ekstreyi parse ÖNİZLEMESİ olarak yükler (henüz kalıcı
 * kayıt yok) → kullanıcı önizler → {@link confirm} `batchRef` ile kalıcılaştırır.
 */
@Injectable({ providedIn: 'root' })
export class StatementsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * Ekstre dosyasını yükler ve parse önizlemesini döndürür.
   *
   * multipart/form-data ile gönderilir — Content-Type başlığı ELLE set EDİLMEZ;
   * tarayıcı FormData için boundary'li başlığı kendisi koyar.
   */
  upload(
    file: File,
    cardLast4: string,
    month: string,
  ): Observable<StatementUploadResponse> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('cardLast4', cardLast4);
    form.append('month', month);
    return this.http.post<StatementUploadResponse>(
      `${this.baseUrl}/statements`,
      form,
    );
  }

  /**
   * Önizlenen parse partisini kalıcılaştırır. {@code batchRef} hangi partinin
   * onaylanacağını açıkça taşır ("en son" varsayımı yok). Yazılan hareket
   * sayısını döndürür.
   */
  confirm(batchRef: string): Observable<StatementConfirmResponse> {
    return this.http.post<StatementConfirmResponse>(
      `${this.baseUrl}/statements/confirm`,
      { batchRef },
    );
  }

  /** Kart referans listesini getirir (kart seçici dropdown'u için). */
  cards(): Observable<CardRef[]> {
    return this.http.get<CardRef[]>(`${this.baseUrl}/cards`);
  }
}
