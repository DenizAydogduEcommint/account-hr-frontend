import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { MonthSelectorComponent } from '../../shared/month-selector/month-selector.component';
import { DEFAULT_MONTH } from '../../shared/default-month';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import {
  InvoiceStatus,
  STATUS_LABELS_TR,
} from '../../shared/status-colors';
import {
  CardRef,
  ExpenseListResponse,
  ExpenseRow,
  STATUS_FILTER_OPTIONS,
} from './expenses.models';
import { ExpensesService } from './expenses.service';

/** Sayfa boyutu (ANA satırlar). */
const PAGE_SIZE = 50;

/**
 * E3-03 — Aylık harcamalar ekranı (12 kolonlu tablo).
 *
 * Excel ay sheet'inin web karşılığı:
 * - 12 kolonlu tablo (yatay kaydırılabilir), tr-TR para formatı, DD.MM.YYYY tarih.
 * - Filtre çubuğu: ay seçici (ortak) + kart + durum + serbest metin (debounce).
 * - Operasyonel toplam tablo altında; bilgi-amaçlı (Multinet/sigorta/vergi) satırlar
 *   AYRI açılır bölümde, kendi alt toplamıyla, operasyonel toplama dahil edilmeden.
 * - Satıra tıklayınca salt-okunur detay modalı (durum değiştir / fatura ekle sonraki
 *   görevlerde — E3-05/E3-07).
 * - Sayfalama; loading/empty/error durumları (dashboard deseni). Sinyal tabanlı servis.
 */
@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [MonthSelectorComponent, StatusBadgeComponent],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss',
})
export class ExpensesComponent implements OnInit, OnDestroy {
  private readonly service = inject(ExpensesService);

  // ---- Liste durumu ------------------------------------------------------
  readonly data = signal<ExpenseListResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  // ---- Filtre / arama / sayfa --------------------------------------------
  readonly month = signal(DEFAULT_MONTH);
  readonly cardFilter = signal('');
  readonly statusFilter = signal<InvoiceStatus | ''>('');
  readonly searchTerm = signal('');
  readonly page = signal(0);

  private readonly search$ = new Subject<string>();
  private searchSub?: Subscription;
  private listSub?: Subscription;

  // ---- Referans veri -----------------------------------------------------
  readonly cards = signal<CardRef[]>([]);

  // ---- Sabit seçenekler / etiketler --------------------------------------
  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly statusLabels = STATUS_LABELS_TR;

  // ---- Türetilmiş ---------------------------------------------------------
  readonly mainRows = computed<ExpenseRow[]>(
    () => this.data()?.main.content ?? [],
  );
  readonly informationalRows = computed<ExpenseRow[]>(
    () => this.data()?.informationalRows ?? [],
  );
  readonly operationalTotalTry = computed(
    () => this.data()?.operationalTotalTry ?? 0,
  );
  readonly informationalTotalTry = computed(
    () => this.data()?.informationalTotalTry ?? 0,
  );
  readonly totalPages = computed(() => this.data()?.main.totalPages ?? 0);
  readonly totalElements = computed(
    () => this.data()?.main.totalElements ?? 0,
  );

  // ---- Bilgi-amaçlı bölüm açık/kapalı ------------------------------------
  readonly infoOpen = signal(true);

  // ---- Detay modalı -------------------------------------------------------
  readonly selectedRow = signal<ExpenseRow | null>(null);

  ngOnInit(): void {
    this.searchSub = this.search$
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.page.set(0);
        this.fetch();
      });

    this.service.cards().subscribe({
      next: (c) => this.cards.set(c),
      error: () => this.cards.set([]),
    });

    this.fetch();
  }

  // ---- Veri çekme --------------------------------------------------------
  private fetch(): void {
    this.listSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);

    this.listSub = this.service
      .list({
        month: this.month(),
        card: this.cardFilter() || null,
        status: this.statusFilter() || null,
        q: this.searchTerm(),
        page: this.page(),
        size: PAGE_SIZE,
        sort: 'transactionDate,asc',
      })
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  // ---- Filtre olayları ---------------------------------------------------
  onMonthChange(month: string): void {
    this.month.set(month);
    this.page.set(0);
    this.fetch();
  }

  onCardChange(event: Event): void {
    this.cardFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(0);
    this.fetch();
  }

  onStatusChange(event: Event): void {
    this.statusFilter.set(
      (event.target as HTMLSelectElement).value as InvoiceStatus | '',
    );
    this.page.set(0);
    this.fetch();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.search$.next(value);
  }

  // ---- Sayfalama ---------------------------------------------------------
  prevPage(): void {
    if (this.page() > 0) {
      this.page.update((p) => p - 1);
      this.fetch();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages() - 1) {
      this.page.update((p) => p + 1);
      this.fetch();
    }
  }

  // ---- Bilgi-amaçlı bölüm ------------------------------------------------
  toggleInfo(): void {
    this.infoOpen.update((v) => !v);
  }

  // ---- Detay modalı ------------------------------------------------------
  openDetail(row: ExpenseRow): void {
    this.selectedRow.set(row);
  }

  closeDetail(): void {
    this.selectedRow.set(null);
  }

  // ---- Şablon yardımcıları ----------------------------------------------
  /** ISO "YYYY-MM-DD" → "DD.MM.YYYY"; null/boş → "—". */
  formatDate(iso: string | null): string {
    if (!iso) {
      return '—';
    }
    const parts = iso.split('-');
    if (parts.length !== 3) {
      return iso;
    }
    const [y, m, d] = parts;
    return `${d}.${m}.${y}`;
  }

  /** Ham sayı → tr-TR "#.##0,00" (₺ ekI opsiyonel). null → "—". */
  formatNumber(value: number | null, withTl = false): string {
    if (value == null) {
      return '—';
    }
    const formatted = value.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return withTl ? `${formatted} ₺` : formatted;
  }

  cardOptionLabel(card: CardRef): string {
    const name = card.label || card.bank;
    return `****${card.last4} · ${name}`;
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.listSub?.unsubscribe();
  }
}
