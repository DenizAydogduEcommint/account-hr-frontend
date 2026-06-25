import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Sol navigasyon. Navy (#010b3c) arka plan, 240px sabit genişlik.
 * Yalnızca "Dashboard" gerçek bir route'tur (routerLink + routerLinkActive);
 * diğerleri henüz mevcut olmayan E3 ekranları için "yakında" placeholder'larıdır
 * (route kırılmasını önlemek için routerLink YOK).
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  /** Diğer E3 ekranları geldikçe `path` eklenip enabled yapılacak. */
  readonly nav = [
    { label: 'Servisler', icon: '◆' },
    { label: 'Harcamalar', icon: '₺' },
    { label: 'Eksik Fatura', icon: '!' },
    { label: 'Faturalar', icon: '▤' },
  ];
}
