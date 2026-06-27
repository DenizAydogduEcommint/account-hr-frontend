import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { UserRole } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Sol navigasyon öğesi.
 * - `path` varsa gerçek route, yoksa "yakında" placeholder.
 * - `allowedRoles` verilmezse herkese görünür; verilirse yalnızca o roller görür
 *   (E3-08 — UI gizleme; gerçek yetki backend'de).
 */
interface NavItem {
  label: string;
  icon: string;
  path?: string;
  allowedRoles?: UserRole[];
}

/**
 * Sol navigasyon. Navy (#010b3c) arka plan, 240px sabit genişlik.
 *
 * Menü tek bir merkezi tanımdan (`ALL_NAV`) gelir; her öğenin `allowedRoles`
 * alanı vardır. Görünür menü (`nav`), giriş yapan kullanıcının rolüne göre
 * süzülmüş computed signal'dır — rol stringleri şablona/koda dağılmaz.
 *
 * `path`'i olan öğeler gerçek route'tur (routerLink + routerLinkActive);
 * `path`'i olmayanlar henüz mevcut olmayan ekranlar için "yakında"
 * placeholder'larıdır (route kırılmasını önlemek için routerLink YOK).
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);

  /**
   * Tüm menü öğeleri (rol filtresi öncesi tek kaynak). Yeni ekran geldikçe
   * burada `path` + `allowedRoles` eklenir.
   *
   * Erişim matrisi (E3-08):
   *  - Dashboard / Harcamalar / Eksik Fatura  → 3 rol de görür (allowedRoles yok)
   *  - Servisler                              → 3 rol de okur (backend GET
   *    /services hasAnyRole); yazma aksiyonları ekranda yalnızca ADMIN.
   */
  private readonly allNav: NavItem[] = [
    { label: 'Dashboard', icon: '▣', path: '/dashboard' },
    { label: 'Servisler', icon: '◆', path: '/services' },
    { label: 'Harcamalar', icon: '₺', path: '/expenses' },
    {
      // Ekstre yükleme (E4-01) — yalnızca ADMIN/ACCOUNTING görür; route da
      // roleGuard(['ADMIN','ACCOUNTING']) ile korunur, backend gerçek kapı.
      label: 'Ekstre Yükle',
      icon: '⭳',
      path: '/statements',
      allowedRoles: ['ADMIN', 'ACCOUNTING'],
    },
    { label: 'Eksik Fatura', icon: '!', path: '/missing-invoices' },
    { label: 'Faturalar', icon: '▤' },
  ];

  /** Role göre süzülmüş görünür menü. allowedRoles yoksa herkese açık. */
  readonly nav = computed<NavItem[]>(() =>
    this.allNav.filter(
      (item) =>
        !item.allowedRoles || this.auth.hasAnyRole(...item.allowedRoles),
    ),
  );
}
