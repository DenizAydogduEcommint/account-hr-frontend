import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  InvoiceUploadRequest,
  InvoiceUploadResponse,
  ParsedInvoiceResponse,
} from './invoice-upload.models';

/**
 * E3-05 — Fatura yükleme veri servisi. Bearer token auth interceptor tarafından otomatik
 * eklenir. multipart/form-data ile servis + ay + dosya(lar) gönderir. Content-Type başlığı
 * ELLE set EDİLMEZ — tarayıcı FormData için boundary'li başlığı kendisi koyar.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceUploadService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Bir fatura yükler (dosya + metadata + durum tek atomik istek). */
  upload(req: InvoiceUploadRequest): Observable<InvoiceUploadResponse> {
    const form = new FormData();
    form.append('serviceId', String(req.serviceId));
    form.append('month', req.month);
    if (req.amount != null) {
      form.append('amount', String(req.amount));
    }
    if (req.currency) {
      form.append('currency', req.currency);
    }
    if (req.description && req.description.trim()) {
      form.append('description', req.description.trim());
    }
    form.append('eInvoice', String(req.eInvoice));
    // KDV oranı opsiyonel: yalnızca verildiyse gönder (yok → sunucu KDV kaydetmez).
    if (req.kdvRate != null) {
      form.append('kdvRate', String(req.kdvRate));
    }
    for (const file of req.files) {
      form.append('files', file, file.name);
    }
    return this.http.post<InvoiceUploadResponse>(
      `${this.baseUrl}/invoices`,
      form,
    );
  }

  /**
   * E5-03 — Tek bir PDF faturayı sunucuda otomatik okur (parse). multipart `file`
   * gönderir; Content-Type ELLE set EDİLMEZ (tarayıcı boundary'yi koyar). Yanıtın
   * tüm alanları nullable; bozuk PDF 200 + warnings döner, geçersiz tip/boyut 400.
   * Yalnızca bilgilendirme/ön-doldurma içindir; hatası yükleme akışını bloklamaz.
   */
  parse(file: File): Observable<ParsedInvoiceResponse> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ParsedInvoiceResponse>(
      `${this.baseUrl}/invoices/parse`,
      form,
    );
  }
}
