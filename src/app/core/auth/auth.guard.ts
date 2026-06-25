import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { UserRole } from './auth.models';
import { AuthService } from './auth.service';

/**
 * Oturum gerektiren route'ları korur. Kimlik doğrulanmamışsa /login'e
 * (returnUrl ile) yönlendirir.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Rol bazlı koruma fabrikası (ileride rol-özel route'lar için — E1-03).
 * Örn: `canActivate: [authGuard, roleGuard(['ADMIN'])]`.
 */
export function roleGuard(allowed: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const user = auth.currentUser();
    if (user && allowed.includes(user.role)) {
      return true;
    }
    // Yetkisiz: oturum varsa dashboard'a, yoksa login'e.
    return router.createUrlTree([user ? '/dashboard' : '/login']);
  };
}
