import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { UserRole } from '../../core/auth/auth.models';
import { environment } from '../../../environments/environment';
import { BackofficeUser, CreateUserRequest } from './backoffice.models';

/**
 * E1-08 Backoffice (kullanıcı yönetimi) veri servisi — ADMIN-only.
 *
 * Bearer token auth interceptor tarafından otomatik eklenir; 401'de interceptor
 * logout eder. Tüm uçlar backend'de ADMIN-only enforce edilir (bu yalnızca UI).
 */
@Injectable({ providedIn: 'root' })
export class BackofficeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** GET /admin/users — tüm giriş kullanıcılarını getirir. */
  list(): Observable<BackofficeUser[]> {
    return this.http.get<BackofficeUser[]>(`${this.baseUrl}/admin/users`);
  }

  /** POST /admin/users — yeni kullanıcı oluşturur. 409: yinelenen e-posta, 400: geçersiz şifre. */
  create(payload: CreateUserRequest): Observable<BackofficeUser> {
    return this.http.post<BackofficeUser>(
      `${this.baseUrl}/admin/users`,
      payload,
    );
  }

  /** PATCH /admin/users/{id}/password — kullanıcının şifresini sıfırlar. */
  resetPassword(id: number, password: string): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/admin/users/${id}/password`,
      { password },
    );
  }

  /** PATCH /admin/users/{id}/role — kullanıcının yetkisini değiştirir. 409: son aktif admin korunması. */
  changeRole(id: number, role: UserRole): Observable<BackofficeUser> {
    return this.http.patch<BackofficeUser>(
      `${this.baseUrl}/admin/users/${id}/role`,
      { role },
    );
  }

  /** PATCH /admin/users/{id}/active — kullanıcıyı aktif/pasif yapar. 409: son aktif admin korunması. */
  setActive(id: number, active: boolean): Observable<BackofficeUser> {
    return this.http.patch<BackofficeUser>(
      `${this.baseUrl}/admin/users/${id}/active`,
      { active },
    );
  }
}
