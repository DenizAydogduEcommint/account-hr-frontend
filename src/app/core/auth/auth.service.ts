import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, tap, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  AuthUser,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
} from './auth.models';

const ACCESS_TOKEN_KEY = 'ah_access_token';
const REFRESH_TOKEN_KEY = 'ah_refresh_token';

/**
 * Kimlik doğrulama servisi.
 *
 * - Access + refresh token'ı localStorage'da saklar (mobil/web aynı API'yi
 *   tükettiği için stateless token mantığı — E1-03).
 * - `currentUser` signal'ı ile giriş yapan kullanıcıyı yayınlar.
 * - Uygulama açılışında token varsa /auth/me ile kullanıcıyı geri yükler.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Giriş yapan kullanıcı; oturum yoksa null. */
  private readonly _currentUser = signal<AuthUser | null>(null);
  readonly currentUser = this._currentUser.asReadonly();

  /** Şablonlarda kolay kullanım için: oturum açık mı? */
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  /** Devam eden tek refresh çağrısı; eşzamanlı 401'ler bunu paylaşır. */
  private refresh$: Observable<AuthResponse> | null = null;

  /** Access token (interceptor için). */
  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  /** Refresh token (interceptor + logout için). */
  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  /** Token saklandı mı? (kullanıcı henüz yüklenmemiş olabilir.) */
  hasToken(): boolean {
    return this.accessToken !== null;
  }

  /** Şu an kimliği doğrulanmış sayılır mı? Guard tarafından kullanılır. */
  isAuthenticated(): boolean {
    return this.hasToken();
  }

  /** POST /auth/login — başarılı olursa token'ları saklar ve kullanıcıyı yayınlar. */
  login(email: string, password: string): Observable<AuthUser> {
    const body: LoginRequest = { email, password };
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, body).pipe(
      tap((res) => this.applyAuthResponse(res)),
      map((res) => res.user),
    );
  }

  /**
   * POST /auth/refresh — access token süresi dolunca yeni access + rotate
   * edilmiş refresh alır. Refresh token yoksa hata fırlatır (oturum yok).
   *
   * Refresh-token rotation nedeniyle eşzamanlı 401'lerin her biri ayrı bir
   * refresh tetiklerse biri diğerlerini geçersiz kılar → rastgele logout.
   * Bunu önlemek için devam eden tek bir refresh çağrısı paylaşılır
   * (`shareReplay(1)`); tamamlanınca/hata alınca temizlenir.
   */
  refresh(): Observable<AuthResponse> {
    if (this.refresh$) {
      return this.refresh$;
    }
    const token = this.refreshToken;
    if (!token) {
      return throwError(() => new Error('Refresh token yok'));
    }
    const body: RefreshRequest = { refreshToken: token };
    this.refresh$ = this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/refresh`, body)
      .pipe(
        tap((res) => this.applyAuthResponse(res)),
        // shareReplay önce: tüm eşzamanlı abonelere tek sonucu yayınlar.
        // finalize sonra: multicast tamamen bitince refresh$ temizlenir, böylece
        // sonuç yayınlanmadan refresh$ erkenden null'a düşüp tekrar refresh tetiklenmez.
        shareReplay(1),
        finalize(() => {
          this.refresh$ = null;
        }),
      );
    return this.refresh$;
  }

  /**
   * POST /auth/logout — refresh token'ı backend'de iptal eder ve yerel
   * durumu temizler. Backend çağrısı başarısız olsa bile yerel oturum
   * her durumda temizlenir.
   */
  logout(): Observable<void> {
    const token = this.refreshToken;
    this.clearSession();

    if (!token) {
      return of(void 0);
    }
    const body: LogoutRequest = { refreshToken: token };
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, body).pipe(
      catchError(() => of(void 0)),
      map(() => void 0),
    );
  }

  /** GET /auth/me — token ile kullanıcıyı getirir ve `currentUser`'a yazar. */
  loadMe(): Observable<AuthUser | null> {
    if (!this.hasToken()) {
      return of(null);
    }
    return this.http.get<AuthUser>(`${this.baseUrl}/auth/me`).pipe(
      tap((user) => this._currentUser.set(user)),
      catchError((error: HttpErrorResponse) => {
        // Yalnızca gerçek auth hatalarında (401/403) oturumu temizle. Ağ
        // hatası (status 0) veya 5xx gibi geçici sorunlarda token'ları KORU;
        // sonraki gerçek auth hatası logout'u zaten tetikler. Aksi halde
        // geçici backend kesintisi kullanıcıyı kalıcı olarak çıkarırdı.
        if (error.status === 401 || error.status === 403) {
          this.clearSession();
        }
        return of(null);
      }),
    );
  }

  /**
   * Uygulama açılışında çağrılır (APP_INITIALIZER). Token varsa kullanıcıyı
   * geri yükler; yoksa hemen tamamlanır.
   */
  restoreSession(): Observable<AuthUser | null> {
    return this.loadMe();
  }

  /** Token'ları sakla ve kullanıcıyı yayınla. */
  private applyAuthResponse(res: AuthResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    this._currentUser.set(res.user);
  }

  /** Yerel oturumu temizle (token + kullanıcı). */
  clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this._currentUser.set(null);
  }
}
