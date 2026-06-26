import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  InvoiceUploadRequest,
  InvoiceUploadResponse,
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
    for (const file of req.files) {
      form.append('files', file, file.name);
    }
    return this.http.post<InvoiceUploadResponse>(
      `${this.baseUrl}/invoices`,
      form,
    );
  }
}
