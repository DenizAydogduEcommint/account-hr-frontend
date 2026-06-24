import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Health } from './models/health.model';

/**
 * Thin HTTP client for the account-hr backend. The base URL comes from the
 * environment so the same code targets local/staging/prod.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** GET {apiBaseUrl}/health → { status: 'UP' } */
  getHealth(): Observable<Health> {
    return this.http.get<Health>(`${this.baseUrl}/health`);
  }
}
