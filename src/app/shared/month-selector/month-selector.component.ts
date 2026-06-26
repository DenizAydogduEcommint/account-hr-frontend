import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';

import { DEFAULT_MONTH } from '../default-month';

/** Bir ay seçeneği: değer "YYYY-MM", etiket "Ocak 2026" gibi. */
export interface MonthOption {
  value: string;
  label: string;
}

const TR_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

/**
 * Yeniden kullanılabilir ay seçici (diğer E3 ekranları da kullanır).
 *
 * - Periyot endpoint'i olmadığından statik liste: 2026-01 .. 2026-12,
 *   Türkçe etiketlerle ("Ocak 2026" .. "Aralık 2026").
 * - Sözleşme: @Input() value ("YYYY-MM") + @Output() valueChange.
 * - Varsayılan seçim: paylaşılan DEFAULT_MONTH (single source of truth).
 */
@Component({
  selector: 'app-month-selector',
  standalone: true,
  imports: [],
  template: `
    <label class="month-selector">
      <span class="month-selector__label">Ay</span>
      <select
        class="month-selector__select"
        (change)="onChange($event)"
        aria-label="Ay seçimi"
      >
        @for (opt of options(); track opt.value) {
          <option [value]="opt.value" [selected]="opt.value === value">{{ opt.label }}</option>
        }
      </select>
    </label>
  `,
  styles: [
    `
      @use 'styles/tokens' as *;

      .month-selector {
        display: inline-flex;
        align-items: center;
        gap: $space-1;

        &__label {
          font-size: 13px;
          font-weight: 500;
          color: $ec-text;
        }

        &__select {
          appearance: none;
          height: 38px;
          padding: 0 $space-4 0 14px;
          border: 1.5px solid $ec-border;
          border-radius: $radius-input;
          background: $ec-bg
            url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23222' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>")
            no-repeat right 12px center;
          color: $ec-text;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;

          &:hover {
            border-color: $ec-primary;
          }

          &:focus {
            outline: none;
            border-color: $ec-primary;
            box-shadow: 0 0 0 3px rgba(0, 178, 122, 0.15);
          }
        }
      }
    `,
  ],
})
export class MonthSelectorComponent {
  /** Seçili ay ("YYYY-MM"). Varsayılan: paylaşılan DEFAULT_MONTH. */
  @Input() value = DEFAULT_MONTH;

  /** Seçim değiştiğinde yeni "YYYY-MM" değerini yayınlar. */
  @Output() valueChange = new EventEmitter<string>();

  /**
   * Seçenek listesinin yılı — geçerli yıldan başlar (2026'ya sabit DEĞİL),
   * böylece 2027+ için liste otomatik kayar.
   */
  private readonly year = signal(new Date().getFullYear());

  /**
   * Seçili `value` ("YYYY-MM") farklı bir yıldaysa, o yılı da listeye dahil et
   * ki seçili ay her zaman render olup seçili görünsün. Tek yıl ise sadece o
   * yıl gösterilir; iki farklı yıl ise her ikisinin 12 ayı da listelenir.
   */
  readonly options = computed<MonthOption[]>(() => {
    const baseYear = this.year();
    const years = new Set<number>([baseYear]);
    const selectedYear = Number(this.value?.split('-')[0]);
    if (!Number.isNaN(selectedYear)) {
      years.add(selectedYear);
    }
    return [...years]
      .sort((a, b) => a - b)
      .flatMap((y) =>
        TR_MONTHS.map((name, i) => {
          const mm = String(i + 1).padStart(2, '0');
          return { value: `${y}-${mm}`, label: `${name} ${y}` };
        }),
      );
  });

  onChange(event: Event): void {
    const next = (event.target as HTMLSelectElement).value;
    this.value = next;
    this.valueChange.emit(next);
  }
}
