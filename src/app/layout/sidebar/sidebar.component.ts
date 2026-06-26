import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Sol navigasyon öğesi. `path` varsa gerçek route, yoksa "yakında" placeholder. */
interface NavItem {
  label: string;
  icon: string;
  path?: string;
}

/**
 * Sol navigasyon. Navy (#010b3c) arka plan, 240px sabit genişlik.
 * `path`'i olan öğeler gerçek route'tur (routerLink + routerLinkActive);
 * `path`'i olmayanlar henüz mevcut olmayan E3 ekranları için "yakında"
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
  /** Diğer E3 ekranları geldikçe `path` eklenip enabled yapılacak. */
  readonly nav: NavItem[] = [
    { label: 'Dashboard', icon: '▣', path: '/dashboard' },
    { label: 'Servisler', icon: '◆', path: '/services' },
    { label: 'Harcamalar', icon: '₺' },
    { label: 'Eksik Fatura', icon: '!' },
    { label: 'Faturalar', icon: '▤' },
  ];
}
