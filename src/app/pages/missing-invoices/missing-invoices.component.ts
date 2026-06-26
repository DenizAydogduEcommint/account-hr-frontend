import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { DEFAULT_MONTH } from '../../shared/default-month';
import { MonthSelectorComponent } from '../../shared/month-selector/month-selector.component';
import {
  FREQUENCY_LABELS_TR,
  MissingInvoiceRow,
} from './missing-invoices.models';
import { MissingInvoicesService } from './missing-invoices.service';

/**
 * E3-04 — Eksik Fatura ekranı (servis ↔ ay çapraz doğrulama, KİLİT MVP).
 *
 * "Bu ay hangi servislerin faturası bekleniyordu ama gelmedi?" sorusunu yanıtlar:
 * banka ekstresinden değil SERVİSLER master listesinden giderek eksikleri listeler.
 * - Başlık + ortak ay seçici (DEFAULT_MONTH).
 * - Belirgin sayaç ("Bu ay N servisin faturası eksik") — dashboard KPI'ı ile birebir aynı.
 * - Eksik servis tablosu: Hizmet, Sağlayıcı, Kart, Frekans (badge), Yaklaşık Tutar (tr-TR),
 *   İlgili E-posta + satır içi aksiyonlar.
 * - Satır aksiyonları placeholder (disabled): "Fatura Yükle" (E3-05) ve "Hatırlatma Gönder"
 *   (E6) — sonraki görevlerde aktifleşir.
 * - Boş durum ("Bu ay tüm faturalar tamam"), loading ve error durumları (dashboard deseni).
 * - Ay değişince yeniden çeker. Sinyal tabanlı servis; Türkçe arayüz.
 */
@Component({
  selector: 'app-missing-invoices',
  standalone: true,
  imports: [MonthSelectorComponent],
  templateUrl: './missing-invoices.component.html',
  styleUrl: './missing-invoices.component.scss',
})
export class MissingInvoicesComponent implements OnInit, OnDestroy {
  private readonly service = inject(MissingInvoicesService);

  // ---- Durum -------------------------------------------------------------
  readonly rows = signal<MissingInvoiceRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly month = signal(DEFAULT_MONTH);

  private listSub?: Subscription;

  // ---- Etiketler ---------------------------------------------------------
  readonly frequencyLabels = FREQUENCY_LABELS_TR;

  // ---- Türetilmiş --------------------------------------------------------
  readonly missingCount = computed(() => this.rows().length);
  readonly hasMissing = computed(() => this.rows().length > 0);

  ngOnInit(): void {
    this.fetch();
  }

  private fetch(): void {
    this.listSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);

    this.listSub = this.service.list(this.month()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  onMonthChange(month: string): void {
    this.month.set(month);
    this.fetch();
  }

  retry(): void {
    this.fetch();
  }

  // ---- Şablon yardımcıları ----------------------------------------------
  /** Ham sayı → tr-TR "#.##0,00" (₺ ekli). null → "—". */
  formatTry(value: number | null): string {
    if (value == null) {
      return '—';
    }
    const formatted = value.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${formatted} ₺`;
  }

  ngOnDestroy(): void {
    this.listSub?.unsubscribe();
  }
}
