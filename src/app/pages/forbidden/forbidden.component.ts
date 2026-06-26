import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

/**
 * 403 — Erişim yok ekranı (E3-08).
 *
 * Rol bazlı route guard'ı (roleGuard) yetkisiz erişimde buraya yönlendirir.
 * Kullanıcıya kendi rolüne uygun açılış ekranına (homeRoute) dönüş linki sunar,
 * böylece yasak ekranda sıkışıp kalmaz. Gerçek yetki backend'de uygulanır;
 * bu yalnızca kullanıcı dostu bir UX katmanıdır.
 */
@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './forbidden.component.html',
  styleUrl: './forbidden.component.scss',
})
export class ForbiddenComponent {
  private readonly auth = inject(AuthService);

  /** Kullanıcının rolüne uygun, asla yasak olmayan açılış route'u. */
  readonly homeRoute = computed(() => this.auth.homeRoute());
}
