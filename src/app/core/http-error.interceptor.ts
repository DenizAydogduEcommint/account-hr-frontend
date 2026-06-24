import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * Stub HTTP error interceptor. For now it just logs and rethrows so callers can
 * handle errors locally (e.g. the dashboard degrading to "API unreachable").
 *
 * TODO: in E1-xx, redirect to login on 401 and surface a global toast on 5xx.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error(`[HTTP ${error.status}] ${req.method} ${req.url}`, error.message);
      return throwError(() => error);
    }),
  );
};
