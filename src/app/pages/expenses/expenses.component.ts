import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  DomSanitizer,
  SafeResourceUrl,
} from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AuthService } from '../../core/auth/auth.service';
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
  FileMeta,
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
  private readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);

  /**
   * Durum değiştirme (PATCH status, E3-07) yetkisi var mı? (E3-08)
   * ADMIN + ACCOUNTING değiştirebilir; TEAM_MEMBER için kontrol gizlenir.
   * Backend gerçek kapıdır — bu yalnızca UI gizlemesidir; 403 gelirse
   * mevcut hata akışı (statusError) zaten zarifçe gösterir.
   */
  readonly canChangeStatus = computed(() =>
    this.auth.hasAnyRole('ADMIN', 'ACCOUNTING'),
  );

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
  private filesSub?: Subscription;
  private previewSub?: Subscription;
  private downloadSub?: Subscription;

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

  // ---- Fatura dosyaları (E3-09) ------------------------------------------
  /** Açık satıra ekli dosyaların metadata listesi. */
  readonly files = signal<FileMeta[]>([]);
  /** Dosya listesi yükleniyor mu. */
  readonly filesLoading = signal(false);
  /** Dosya listesi yüklenemedi (ağ/sunucu hatası). */
  readonly filesError = signal(false);

  /** Şu an önizlenen dosya (null → önizleme kapalı). */
  readonly previewFile = signal<FileMeta | null>(null);
  /** Önizleme içeriği yükleniyor mu. */
  readonly previewLoading = signal(false);
  /** Önizleme hata mesajı (404 → "bulunamadı", 403 → yetki, diğer → genel). */
  readonly previewError = signal<string | null>(null);
  /** PDF/görsel için güvenli blob: URL (sanitizer'dan geçirilmiş). */
  readonly previewSafeUrl = signal<SafeResourceUrl | null>(null);
  /** XML ham metin içeriği. */
  readonly previewText = signal<string | null>(null);
  /** Aktif object URL (revoke için ham string olarak saklanır). */
  private previewObjectUrl: string | null = null;

  /**
   * Önizleme "kuşağı" sayacı. Her preview() çağrısı ve her kapanış
   * (closePreview/resetFiles) bunu artırır. Asenkron iş (blob.text() Promise
   * veya blob subscription) tamamlandığında yakalanan `gen` güncel sayaçla
   * eşleşmiyorsa hiçbir sinyal yazılmaz → kapanmış/değişmiş önizlemeye
   * bayat içerik / hayalet loading yazılmasını önler.
   */
  private previewGeneration = 0;

  // ---- İndirme durumu (E3-09) --------------------------------------------
  /**
   * İndirme hatası mesajı — önizleme hatasından TAMAMEN ayrı tutulur ki
   * bir dosyanın indirme hatası, başka bir dosyanın açık önizlemesini
   * kirletmesin.
   */
  readonly downloadError = signal<string | null>(null);
  /** Hangi dosyanın indirmesinin hata verdiği (satır-içi mesaj için). */
  readonly downloadErrorFileId = signal<number | null>(null);
  /** Şu an indirilen dosyanın id'si (null → indirme yok). Butonu kilitler. */
  readonly downloadingFileId = signal<number | null>(null);

  // Render kararı backend `fileType` enum'ına (PDF|XML|STATEMENT|RECEIPT|OTHER)
  // DEĞİL, `mimeType`'a göre verilir: fotoğraflanmış faturalar RECEIPT/OTHER
  // olarak gelir ama mimeType=image/* taşır. fileType'a bakmak görsel
  // faturalarda boş önizlemeye yol açardı.
  /** Önizlenen dosyanın türü görsel mi (img ile gösterilir). */
  readonly previewIsImage = computed(() => {
    const m = this.previewFile()?.mimeType ?? '';
    return m.startsWith('image/');
  });
  /** Önizlenen dosya PDF mi (iframe ile gösterilir). */
  readonly previewIsPdf = computed(
    () => this.previewFile()?.mimeType === 'application/pdf',
  );
  /** Önizlenen dosya XML mi (pre ile ham metin gösterilir). */
  readonly previewIsXml = computed(() => {
    const m = this.previewFile()?.mimeType ?? '';
    return m.includes('xml');
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
    this.loadFiles(row.id);
  }

  closeDetail(): void {
    if (this.statusSaving()) {
      return;
    }
    this.selectedRow.set(null);
    this.pendingStatus.set(null);
    this.statusError.set(null);
    this.resetFiles();
  }

  // ---- Fatura dosyaları (E3-09) ------------------------------------------

  /** Açık satıra ait dosya listesini çeker. */
  private loadFiles(expenseId: number): void {
    this.filesSub?.unsubscribe();
    this.files.set([]);
    this.filesError.set(false);
    this.filesLoading.set(true);

    this.filesSub = this.service.expenseFiles(expenseId).subscribe({
      next: (list) => {
        this.files.set(list);
        this.filesLoading.set(false);
      },
      error: () => {
        this.filesError.set(true);
        this.filesLoading.set(false);
      },
    });
  }

  /** Dosya listesi + canlı önizlemeyi temizler (modal kapanışı / yeniden açılış). */
  private resetFiles(): void {
    this.filesSub?.unsubscribe();
    this.closePreview();
    // İndirmeyi de iptal et + indirme hata/durum sinyallerini temizle.
    this.downloadSub?.unsubscribe();
    this.downloadingFileId.set(null);
    this.downloadError.set(null);
    this.downloadErrorFileId.set(null);
    this.files.set([]);
    this.filesLoading.set(false);
    this.filesError.set(false);
  }

  /** Aktif object URL'i (varsa) serbest bırakır — bellek sızıntısını önler. */
  private revokePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }

  /** Bir dosyayı önizle: blob'u (auth taşıyan XHR ile) çek, türüne göre göster. */
  preview(file: FileMeta): void {
    this.previewSub?.unsubscribe();
    // Yeni bir önizleme kuşağı başlat → in-flight (önceki) asenkron işler
    // tamamlandığında sinyal yazamaz (gen uyuşmaz).
    const gen = ++this.previewGeneration;
    // Önceki object URL'i mutlaka revoke et (yeni oluşturmadan önce).
    this.revokePreviewUrl();
    this.previewSafeUrl.set(null);
    this.previewText.set(null);
    this.previewError.set(null);
    this.previewFile.set(file);
    this.previewLoading.set(true);

    this.previewSub = this.service.previewBlob(file.id).subscribe({
      next: (blob) => {
        if (file.mimeType.includes('xml')) {
          // XML → ham metin olarak <pre> içinde göster.
          blob
            .text()
            .then((txt) => {
              // Önizleme kapandı/değişti ise yazma (bayat yazımı önle).
              if (gen !== this.previewGeneration) {
                return;
              }
              this.previewText.set(txt);
              this.previewLoading.set(false);
            })
            .catch(() => {
              if (gen !== this.previewGeneration) {
                return;
              }
              this.previewError.set('Dosya içeriği okunamadı.');
              this.previewLoading.set(false);
            });
          return;
        }
        // Önizleme kapandı/değişti ise object URL bile oluşturma.
        if (gen !== this.previewGeneration) {
          return;
        }
        // PDF (iframe) / JPG-PNG (img) → blob: URL + sanitizer.
        const url = URL.createObjectURL(blob);
        this.previewObjectUrl = url;
        this.previewSafeUrl.set(
          this.sanitizer.bypassSecurityTrustResourceUrl(url),
        );
        this.previewLoading.set(false);
      },
      error: (err: { status?: number }) => {
        if (gen !== this.previewGeneration) {
          return;
        }
        this.previewLoading.set(false);
        if (err?.status === 404) {
          this.previewError.set('Dosya bulunamadı veya silinmiş.');
        } else if (err?.status === 403) {
          this.previewError.set('Bu dosyayı görüntüleme yetkiniz yok.');
        } else {
          this.previewError.set('Önizleme yüklenemedi. Lütfen tekrar deneyin.');
        }
      },
    });
  }

  /** Önizlemeyi kapat: aktif object URL'i revoke et, durumu sıfırla. */
  closePreview(): void {
    this.previewSub?.unsubscribe();
    // Kuşağı ilerlet → in-flight asenkron işler artık sinyal yazamaz.
    this.previewGeneration++;
    this.revokePreviewUrl();
    this.previewFile.set(null);
    this.previewSafeUrl.set(null);
    this.previewText.set(null);
    this.previewError.set(null);
    this.previewLoading.set(false);
  }

  /** Dosyayı indir: blob'u çek → gerçek dosya adıyla tarayıcı kaydı tetikle. */
  download(file: FileMeta): void {
    // Aynı anda zaten bir indirme sürüyorsa yeni tıklamayı yok say
    // (eşzamanlı indirmelerin birbirini sessizce iptal etmesini önle).
    if (this.downloadingFileId() != null) {
      return;
    }
    this.downloadSub?.unsubscribe();
    // Bu dosya için önceki indirme hatasını temizle.
    if (this.downloadErrorFileId() === file.id) {
      this.downloadError.set(null);
      this.downloadErrorFileId.set(null);
    }
    this.downloadingFileId.set(file.id);

    this.downloadSub = this.service.downloadBlob(file.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.downloadingFileId.set(null);
      },
      error: (err: { status?: number }) => {
        // İndirme hatası önizleme sinyallerine DOKUNMAZ → açık başka bir
        // dosyanın önizlemesi kirletilmez. Ayrı downloadError sinyali kullanılır.
        if (err?.status === 404) {
          this.downloadError.set('Dosya bulunamadı veya silinmiş.');
        } else if (err?.status === 403) {
          this.downloadError.set('Bu dosyayı indirme yetkiniz yok.');
        } else {
          this.downloadError.set('Dosya indirilemedi. Lütfen tekrar deneyin.');
        }
        this.downloadErrorFileId.set(file.id);
        this.downloadingFileId.set(null);
      },
    });
  }

  /** Bayt → okunabilir boyut (KB/MB). */
  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KB`;
    }
    const mb = kb / 1024;
    return `${mb.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`;
  }

  /**
   * Dosya rozeti: önce `mimeType`'tan anlamlı bir etiket türet
   * (PDF/IMG/XML), aksi halde backend `fileType` enum'ını göster.
   * STATEMENT/RECEIPT/OTHER gibi türler image taşıyorsa "IMG" gösterilir,
   * böylece rozet boş/anlamsız kalmaz. Dönüş `data-type` renklendirmesiyle
   * uyumludur (PDF/XML/IMG).
   */
  fileBadge(file: FileMeta): string {
    const m = file.mimeType ?? '';
    if (m === 'application/pdf') {
      return 'PDF';
    }
    if (m.includes('xml')) {
      return 'XML';
    }
    if (m.startsWith('image/')) {
      return 'IMG';
    }
    return file.fileType || 'DOSYA';
  }

  /** ISO datetime → "DD.MM.YYYY HH:mm" (tr-TR), null/boş → "—". */
  formatUploadedAt(iso: string | null): string {
    if (!iso) {
      return '—';
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
    // Açık olabilecek detayı kapat (savunmacı sertleştirme): ileride UI
    // değişse bile oluşturma sonrası bayat detay gösterilmesin.
    this.selectedRow.set(null);
    this.pendingStatus.set(null);
    this.resetFiles();
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
    this.filesSub?.unsubscribe();
    this.previewSub?.unsubscribe();
    this.downloadSub?.unsubscribe();
    // Canlı object URL'i serbest bırak (bellek sızıntısını önle).
    this.revokePreviewUrl();
  }
}
