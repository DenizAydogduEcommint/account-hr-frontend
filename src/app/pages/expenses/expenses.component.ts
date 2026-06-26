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
import { ExpenseCreateModalComponent } from '../../shared/expense-create/expense-create-modal.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import {
  InvoiceStatus,
  STATUS_COLORS,
  STATUS_LABELS_TR,
  STATUS_ORDER,
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
  imports: [
    MonthSelectorComponent,
    StatusBadgeComponent,
    ExpenseCreateModalComponent,
  ],
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
  private cardsSub?: Subscription;
  private statusSub?: Subscription;

  // ---- Referans veri -----------------------------------------------------
  readonly cards = signal<CardRef[]>([]);

  // ---- Sabit seçenekler / etiketler --------------------------------------
  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly statusLabels = STATUS_LABELS_TR;
  readonly statusColors = STATUS_COLORS;

  /** Durum değiştir dropdown'unun 5 seçeneği (sabit sıra, tek kaynak). */
  readonly statusChangeOptions = STATUS_ORDER;

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

  // ---- Durum değiştir (E3-07) --------------------------------------------
  /** Dropdown'da seçili (henüz kaydedilmemiş) durum. */
  readonly pendingStatus = signal<InvoiceStatus | null>(null);
  /** PATCH devam ediyor mu (buton/dropdown disabled + pending metin). */
  readonly statusSaving = signal(false);
  /** Inline hata mesajı (400/404 vb.); başarıda temizlenir. */
  readonly statusError = signal<string | null>(null);

  /** Seçili durum, satırın mevcut durumundan farklıysa kaydet aktif. */
  readonly statusChanged = computed(() => {
    const row = this.selectedRow();
    const pending = this.pendingStatus();
    return row != null && pending != null && pending !== row.invoiceStatus;
  });

  // ---- Yeni satır ekle modalı (E3-06) ------------------------------------
  readonly createOpen = signal(false);

  /** Yeni satır için ön-dolu tarih: seçili ayın ilk günü ("YYYY-MM-01"). */
  readonly createDefaultDate = computed(() => `${this.month()}-01`);

  ngOnInit(): void {
    this.searchSub = this.search$
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.page.set(0);
        this.fetch();
      });

    this.cardsSub = this.service.cards().subscribe({
      next: (c) => this.cards.set(c),
      error: () => this.cards.set([]),
    });

    this.fetch();
  }

  // ---- Veri çekme --------------------------------------------------------
  /**
   * Mevcut filtre/sayfa için listeyi çeker. {@link onLoaded} verilirse başarılı
   * yanıttan sonra çalışır (ör. açık modalı taze veriyle yeniden eşitlemek için).
   */
  private fetch(onLoaded?: (res: ExpenseListResponse) => void): void {
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
          onLoaded?.(res);
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
    this.pendingStatus.set(row.invoiceStatus);
    this.statusError.set(null);
    this.statusSaving.set(false);
  }

  closeDetail(): void {
    if (this.statusSaving()) {
      return;
    }
    this.selectedRow.set(null);
    this.pendingStatus.set(null);
    this.statusError.set(null);
  }

  // ---- Durum değiştir (E3-07) --------------------------------------------
  /** Dropdown seçimi → bekleyen durumu güncelle (henüz kaydetmez). */
  onPendingStatusChange(event: Event): void {
    this.statusError.set(null);
    this.pendingStatus.set(
      (event.target as HTMLSelectElement).value as InvoiceStatus,
    );
  }

  /**
   * Seçili durumu kaydet: PATCH → başarıda modalı kapat ve mevcut ayın
   * listesini + toplamlarını yeniden çek (rozet yeni renkle render olur).
   * 400/404 inline {@link statusError} olarak gösterilir.
   */
  saveStatus(): void {
    const row = this.selectedRow();
    const next = this.pendingStatus();
    if (!row || next == null || next === row.invoiceStatus) {
      return;
    }

    this.statusSub?.unsubscribe();
    this.statusSaving.set(true);
    this.statusError.set(null);

    this.statusSub = this.service.updateStatus(row.id, next).subscribe({
      next: () => {
        this.statusSaving.set(false);
        // Modalı kapat + mevcut ay listesini/toplamlarını yenile.
        this.selectedRow.set(null);
        this.pendingStatus.set(null);
        this.fetch();
      },
      error: (err: { status?: number }) => {
        this.statusSaving.set(false);

        if (err?.status === 404) {
          // Satır artık yok (başka oturum sildi/değiştirdi): modalı kapat ki
          // bayat rozet kaybolsun, ardından listeyi tazele.
          this.statusError.set('Satır bulunamadı. Liste güncel olmayabilir.');
          this.selectedRow.set(null);
          this.pendingStatus.set(null);
          this.fetch();
          return;
        }

        // Diğer hatalar (400/ağ): modal açık kalsın (kullanıcı tekrar deneyebilir),
        // ama listeyi sunucu gerçeğiyle tazele ve modal görünümünü taze satırla
        // yeniden eşitle (rozet açılışta yakalanan bayat satırı değil, canlı durumu
        // göstersin). Satır artık listede yoksa modalı kapat.
        this.statusError.set('Durum güncellenemedi. Lütfen tekrar deneyin.');
        const editingId = row.id;
        this.fetch((res) => {
          const fresh =
            res.main.content.find((r) => r.id === editingId) ??
            res.informationalRows.find((r) => r.id === editingId) ??
            null;
          this.selectedRow.set(fresh);
          this.pendingStatus.set(fresh ? fresh.invoiceStatus : null);
        });
      },
    });
  }

  // ---- Yeni satır ekle modalı (E3-06) ------------------------------------
  openCreate(): void {
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  /** Satır oluşturuldu → modalı kapat, ilk sayfaya dön, listeyi+toplamı yenile. */
  onCreated(): void {
    this.createOpen.set(false);
    this.page.set(0);
    this.fetch();
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
    this.cardsSub?.unsubscribe();
    this.statusSub?.unsubscribe();
  }
}
