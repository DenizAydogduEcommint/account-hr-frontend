import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * HTTP error interceptor. Logs and rethrows so callers handle errors locally
 * (e.g. the dashboard degrading to "API unreachable", expenses showing an inline
 * status error). Every page-level subscription has an `error` handler, so a
 * rethrown error never bubbles unhandled / crashes the app.
 *
 * 403 (Forbidden) — E3-08: role-based UI hiding (menu + actions + route guards)
 * prevents most forbidden calls, but a stale UI could still trigger one. Because
 * backend is the real authorization gate, a 403 is rethrown like any other error
 * and surfaced gracefully by the caller (inline message / error state-box) rather
 * than crashing. We do NOT clear the session on 403 (that's only for 401, handled
 * by AuthService.loadMe) — a forbidden action must not log the user out.
 *
 * TODO: in a later story, surface a global toast on 5xx.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error(`[HTTP ${error.status}] ${req.method} ${req.url}`, error.message);
      return throwError(() => error);
    }),
  );
};
