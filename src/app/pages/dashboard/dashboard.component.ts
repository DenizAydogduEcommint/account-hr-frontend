import { CurrencyPipe } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  ApexChart,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexResponsive,
  ApexTooltip,
  NgApexchartsModule,
} from 'ng-apexcharts';

import {
  STATUS_LABELS_TR,
  STATUS_ORDER,
} from '../../shared/status-colors';
import { MonthSelectorComponent } from '../../shared/month-selector/month-selector.component';
import { DEFAULT_MONTH } from '../../shared/default-month';
import { DashboardSummary } from './dashboard.models';
import { DashboardService } from './dashboard.service';

/** Donut grafik ayarları (ng-apexcharts). */
interface DonutChartOptions {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  colors: string[];
  legend: ApexLegend;
  tooltip: ApexTooltip;
  responsive: ApexResponsive[];
  dataLabels: { enabled: boolean };
  stroke: { width: number; colors: string[] };
}

/**
 * E3-01 Dashboard — aylık harcama/fatura özeti.
 *
 * - Sinyal tabanlı durum: month, summary, loading, error.
 * - Ay değişince yeniden veri çeker, tüm kartları + grafiği günceller.
 * - Boş ay (totalTry 0 ve expenseCount 0) → dostça Türkçe boş durum,
 *   bozuk donut RENDER EDİLMEZ.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CurrencyPipe, NgApexchartsModule, MonthSelectorComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly service = inject(DashboardService);

  /**
   * Devam eden tek getSummary aboneliği. Ay hızla değişince önceki (yavaş)
   * istek iptal edilir ki gecikmeli yanıt daha yeni veriyi EZMESİN
   * (stale-response race). Her fetch() başında unsubscribe edilir.
   */
  private summarySub?: Subscription;

  /** Seçili ay; varsayılan paylaşılan DEFAULT_MONTH (son tam dolu ay). */
  readonly month = signal(DEFAULT_MONTH);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  /** Veri var mı? Boş ay: özet yok ya da hiç harcama yok. */
  readonly hasData = computed(() => {
    const s = this.summary();
    if (!s) {
      return false;
    }
    const totalCounts = s.statusCounts.reduce((acc, c) => acc + c.count, 0);
    return !(s.totalTry === 0 && totalCounts === 0 && s.expenseCount === 0);
  });

  /** Donut grafik ayarları — renkler/etiketler STATUS_ORDER ile hizalı. */
  readonly chartOptions = computed<DonutChartOptions>(() => {
    const s = this.summary();
    const counts = s?.statusCounts ?? [];

    // Sabit sıraya göre seri/etiket/renk hizala (ApexCharts otomatik renk
    // atamasın diye explicit colors veriyoruz). colorHex `#` içermez → ekle.
    const ordered = STATUS_ORDER.map((status) => {
      const found = counts.find((c) => c.status === status);
      const colorHex = found?.colorHex
        ? `#${found.colorHex}`
        : '#cccccc';
      return {
        status,
        count: found?.count ?? 0,
        color: colorHex,
        label: STATUS_LABELS_TR[status],
      };
    });

    return {
      series: ordered.map((o) => o.count),
      chart: {
        type: 'donut',
        height: 320,
        fontFamily: 'Maven Pro, sans-serif',
      },
      labels: ordered.map((o) => o.label),
      colors: ordered.map((o) => o.color),
      legend: {
        position: 'bottom',
        fontSize: '13px',
        fontWeight: 500,
      },
      tooltip: {
        y: { formatter: (val: number) => `${val} fatura` },
      },
      dataLabels: { enabled: false },
      stroke: { width: 2, colors: ['#ffffff'] },
      responsive: [
        {
          breakpoint: 768,
          options: { chart: { height: 280 } },
        },
      ],
    };
  });

  /**
   * Eksik faturaların yaklaşık TL toplamı, "~#.##0,00 ₺" (tr-TR) biçiminde (E3-10).
   * Backend alanı vermezse 0 say → "~0,00 ₺". `~` tahmini işaretler.
   */
  formatMissingTotal(value: number | null | undefined): string {
    const n = value ?? 0;
    const formatted = n.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `~${formatted} ₺`;
  }

  ngOnInit(): void {
    this.fetch(this.month());
  }

  /** Ay seçici değiştiğinde. */
  onMonthChange(month: string): void {
    this.month.set(month);
    this.fetch(month);
  }

  private fetch(month: string): void {
    // Önceki devam eden isteği iptal et — yavaş gelen eski yanıt yeni veriyi
    // ezmesin (stale-response race).
    this.summarySub?.unsubscribe();

    this.loading.set(true);
    this.error.set(false);
    this.summary.set(null);

    this.summarySub = this.service.getSummary(month).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.summarySub?.unsubscribe();
  }
}
