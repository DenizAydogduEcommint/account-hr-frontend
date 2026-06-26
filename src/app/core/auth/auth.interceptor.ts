import {
  HttpContextToken,
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/** Token ekleme/yenileme atlanacak uçlar (login & refresh kendileri token taşımaz). */
const AUTH_SKIP_PATHS = ['/auth/login', '/auth/refresh'];

/**
 * Refresh sonrası tekrar gönderilen isteği işaretler. İşaretli bir istek
 * tekrar 401 alırsa yeniden refresh DENENMEZ — sonsuz refresh/retry döngüsünü
 * önler; hata yukarı propagate edilir ve oturum kapatılır.
 */
const RETRIED = new HttpContextToken<boolean>(() => false);

function isApiRequest(url: string): boolean {
  return url.startsWith(environment.apiBaseUrl);
}

function shouldSkip(url: string): boolean {
  return AUTH_SKIP_PATHS.some((path) => url.includes(path));
}

/** İsteğe Authorization: Bearer <access> başlığını ekler. */
function withAuthHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Auth interceptor (E1-03):
 * - API isteklerine (login/refresh hariç) `Authorization: Bearer <access>` ekler.
 * - 401 alınırsa BİR kez `refresh()` dener ve isteği tekrar gönderir.
 * - Refresh de başarısız olursa oturumu kapatır ve /login'e yönlendirir.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // API dışı istekleri (örn. statik dosyalar) olduğu gibi geçir.
  if (!isApiRequest(req.url) || shouldSkip(req.url)) {
    return next(req);
  }

  const token = auth.accessToken;
  const authedReq = token ? withAuthHeader(req, token) : req;

  return next(authedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Sentinel'i GÖNDERİLEN isteğin context'inden oku (`authedReq`), orijinal
      // `req`'ten değil. `handle401` retry'ı RETRIED=true ile işaretlediği için
      // retry edilmiş bir istek yeniden 401 alırsa burada refresh DENENMEZ →
      // sonsuz refresh/retry döngüsü kırılır. (Logout, retry'ın kendi inner
      // catchError'ında yapılır.)
      if (
        error.status !== 401 ||
        authedReq.context.get(RETRIED) ||
        !auth.refreshToken
      ) {
        return throwError(() => error);
      }
      return handle401(req, next, auth, router);
    }),
  );
};

/** 401 sonrası tek seferlik refresh + retry. Başarısızsa logout + /login. */
function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  return auth.refresh().pipe(
    switchMap((res) => {
      // Tekrar gönderilen isteği RETRIED ile işaretle; bu istek yeniden 401
      // alırsa üstteki catchError (authedReq.context üzerinden) döngüyü kırar.
      const retriedReq = withAuthHeader(req, res.accessToken).clone({
        context: req.context.set(RETRIED, true),
      });
      return next(retriedReq).pipe(
        catchError((retryError: HttpErrorResponse) => {
          // Refresh sonrası retry yine başarısız (örn. tekrar 401) → oturumu
          // kapat ve login'e gönder. Bu istek RETRIED işaretli olduğundan
          // üstteki catchError yeniden refresh tetiklemez (çift refresh yok).
          auth.clearSession();
          void router.navigate(['/login']);
          return throwError(() => retryError);
        }),
      );
    }),
    catchError((refreshError) => {
      // refresh() çağrısının kendisi başarısız oldu → oturumu kapat.
      auth.clearSession();
      void router.navigate(['/login']);
      return throwError(() => refreshError);
    }),
  );
}
