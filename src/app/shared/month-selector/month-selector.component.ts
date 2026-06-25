import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';

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
 * - Varsayılan seçim: geçerli ay "2026-06".
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
        [value]="value"
        (change)="onChange($event)"
        aria-label="Ay seçimi"
      >
        @for (opt of options(); track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
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
  /** Seçili ay ("YYYY-MM"). Varsayılan: geçerli ay. */
  @Input() value = '2026-06';

  /** Seçim değiştiğinde yeni "YYYY-MM" değerini yayınlar. */
  @Output() valueChange = new EventEmitter<string>();

  /** Üretilen seçenek listesi (statik 2026-01 .. 2026-12). */
  private readonly year = signal(2026);

  readonly options = computed<MonthOption[]>(() => {
    const y = this.year();
    return TR_MONTHS.map((name, i) => {
      const mm = String(i + 1).padStart(2, '0');
      return { value: `${y}-${mm}`, label: `${name} ${y}` };
    });
  });

  onChange(event: Event): void {
    const next = (event.target as HTMLSelectElement).value;
    this.value = next;
    this.valueChange.emit(next);
  }
}
