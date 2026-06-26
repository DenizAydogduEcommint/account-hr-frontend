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
 * Rol bazlı koruma fabrikası (E3-08). Kullanıcının rolü `allowed` listesinde
 * değilse `/403` (ForbiddenComponent) ekranına yönlendirir. Oturum yoksa
 * (rol null) login'e atar — normalde authGuard bunu önce yakalar.
 *
 * Yalnızca UI katmanıdır; gerçek yetki backend'de uygulanır. Örn:
 *   `canActivate: [authGuard, roleGuard(['ADMIN'])]`
 */
export function roleGuard(allowed: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.hasAnyRole(...allowed)) {
      return true;
    }
    // Oturum var ama yetki yok → /403; oturum yok → login.
    return router.createUrlTree([auth.isAuthenticated() ? '/403' : '/login']);
  };
}

/**
 * İndeks (`/`) açılış yönlendiricisi (E3-08). Kullanıcının rolüne göre uygun
 * açılış ekranına gönderir (ADMIN/TEAM_MEMBER → dashboard, ACCOUNTING →
 * eksik faturalar). Böylece hiçbir rol yasak bir ekrana düşmez.
 *
 * Bir CanActivate guard'ı olarak UrlTree döndürür; route asla "aktive" olmaz,
 * her zaman role uygun hedefe yönlendirir.
 */
export const landingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return router.createUrlTree([auth.homeRoute()]);
};
