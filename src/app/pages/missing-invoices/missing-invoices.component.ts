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
import { InvoiceUploadModalComponent } from '../../shared/invoice-upload/invoice-upload-modal.component';
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
  imports: [MonthSelectorComponent, InvoiceUploadModalComponent],
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

  // ---- Fatura yükleme modalı (E3-05) ------------------------------------
  /** Açık modalın hedef satırı; null ise modal kapalı. */
  readonly uploadTarget = signal<MissingInvoiceRow | null>(null);
  /** Başarılı yükleme sonrası kısa bilgi mesajı (toast yerine). */
  readonly uploadSuccess = signal<string | null>(null);

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

  // ---- Fatura yükleme modalı aksiyonları (E3-05) ------------------------

  /** Bir satır için yükleme modalını açar (servisId + ay ön-dolu). */
  openUpload(row: MissingInvoiceRow): void {
    this.uploadSuccess.set(null);
    this.uploadTarget.set(row);
  }

  /** Modal kapatıldı (iptal). */
  closeUpload(): void {
    this.uploadTarget.set(null);
  }

  /**
   * Yükleme başarılı: modalı kapat, kısa başarı mesajı göster ve listeyi + sayacı
   * yenile (yüklenen servis artık eksik listesinde olmamalı → sayaç düşer).
   */
  onUploaded(serviceName: string): void {
    this.uploadTarget.set(null);
    this.uploadSuccess.set(
      `${serviceName} için fatura yüklendi. Eksik listesi güncellendi.`,
    );
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
