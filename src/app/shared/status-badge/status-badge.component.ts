import { Component, Input } from '@angular/core';

import {
  InvoiceStatus,
  STATUS_COLORS,
  STATUS_LABELS_TR,
} from '../status-colors';

/**
 * Ortak fatura durumu rozeti (E3-03'te çıkarıldı; dashboard / servisler / eksik fatura
 * ekranları da kullanabilir). Fatura durumunu renkli bir "pill" olarak gösterir.
 *
 * - Renk tek kaynak {@link STATUS_COLORS}'tan (backend StatusColors aynası) inline arka
 *   plan rengi olarak uygulanır — beş durum (FOUND/E_INVOICE/EXPECTED/TO_INVESTIGATE/IGNORED)
 *   için doğru renk garanti edilir, ekstra SCSS sınıfı gerekmez.
 * - Etiket {@link STATUS_LABELS_TR}'den (Türkçe).
 * - {@code status} null ise (hiç invoice yoksa) nötr "—" gösterilir.
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [],
  template: `
    @if (status) {
      <span class="status-badge" [style.background-color]="color()">
        {{ label() }}
      </span>
    } @else {
      <span class="status-badge status-badge--none">—</span>
    }
  `,
  styles: [
    `
      .status-badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        color: #fff;
        white-space: nowrap;
      }

      .status-badge--none {
        background: #efefef;
        color: rgba(34, 34, 34, 0.55);
      }
    `,
  ],
})
export class StatusBadgeComponent {
  /** Gösterilecek fatura durumu; null ise nötr "—". */
  @Input() status: InvoiceStatus | null = null;

  color(): string {
    return this.status ? STATUS_COLORS[this.status] : '#efefef';
  }

  label(): string {
    return this.status ? STATUS_LABELS_TR[this.status] : '—';
  }
}
