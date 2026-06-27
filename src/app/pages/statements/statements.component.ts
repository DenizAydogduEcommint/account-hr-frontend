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
import { PageInfoComponent } from '../../shared/page-info/page-info.component';
import { CardRef } from '../expenses/expenses.models';
import {
  ParsedTxn,
  STATEMENT_ALLOWED_EXTENSIONS,
  STATEMENT_MAX_FILE_SIZE_BYTES,
  StatementUploadResponse,
} from './statements.models';
import { StatementsService } from './statements.service';

/**
 * E4-01 — Banka ekstresi yükleme ekranı (parse önizle → onayla).
 *
 * Akış:
 *  1) Form: dosya (.xlsx/.xls/.docx) + kart + ay seç. İstemci doğrulaması
 *     (üçü de zorunlu, dosya tipi/boyutu).
 *  2) "Yükle" → POST /statements (multipart) → parse ÖNİZLEMESİ (henüz kalıcı
 *     kayıt yok): hareket tablosu + uyarı paneli. `alreadyUploaded` bildirimi.
 *  3) "Onayla" → POST /statements/confirm (batchRef) → kalıcılaştır, başarı
 *     bildirimi, formu sıfırla. "İptal" → önizlemeyi temizle.
 *
 * Parser şu an sunucu tarafında placeholder; çoğunlukla boş hareket + açıklayıcı
 * uyarı döner. UI bunu kırılmadan gösterir (boş-durum + uyarı paneli) ve tam
 * akışı yine de sergiler. Onayla yalnızca onaylanacak hareket varsa aktiftir.
 *
 * Yetki: ADMIN / ACCOUNTING (route roleGuard + sidebar gizleme; backend gerçek
 * kapıdır). Sinyal tabanlı; OnDestroy'da tüm abonelikler iptal edilir.
 */
@Component({
  selector: 'app-statements',
  standalone: true,
  imports: [MonthSelectorComponent, PageInfoComponent],
  templateUrl: './statements.component.html',
  styleUrl: './statements.component.scss',
})
export class StatementsComponent implements OnInit, OnDestroy {
  /** Sayfa bilgi kartı madde listesi (apostroflar güvende olsun diye .ts'te). */
  readonly pageInfoItems: string[] = [
    'Ekstre dosyasını (Excel veya Word), kartı ve ayı seç, sonra yükle',
    'Sistemin okuduğu işlemleri kontrol et',
    'Doğruysa onayla, işlemler kaydedilsin',
    'Not: Bazı banka dosyaları için otomatik okuma henüz hazırlanıyor',
  ];

  private readonly service = inject(StatementsService);

  private uploadSub?: Subscription;
  private confirmSub?: Subscription;
  private cardsSub?: Subscription;

  // ---- Referans veri -----------------------------------------------------
  readonly cards = signal<CardRef[]>([]);

  // ---- Form durumu -------------------------------------------------------
  /** Seçili dosya (henüz yüklenmemiş). */
  readonly file = signal<File | null>(null);
  /** İstemci-taraflı dosya doğrulama hatası (tip/boyut). */
  readonly fileError = signal<string | null>(null);
  /** Seçili kart (son 4 hane). */
  readonly cardLast4 = signal('');
  /** Seçili ay ("YYYY-MM"). */
  readonly month = signal(DEFAULT_MONTH);

  // ---- Yükleme / önizleme durumu -----------------------------------------
  /** Yükleme (parse) devam ediyor mu. */
  readonly uploading = signal(false);
  /** Yükleme hatası (anlaşılır Türkçe mesaj). */
  readonly uploadError = signal<string | null>(null);
  /** Parse önizleme yanıtı (null → henüz yüklenmedi / temizlendi). */
  readonly preview = signal<StatementUploadResponse | null>(null);

  // ---- Onay durumu --------------------------------------------------------
  /** Onay devam ediyor mu. */
  readonly confirming = signal(false);
  /** Onay hatası (anlaşılır Türkçe mesaj). */
  readonly confirmError = signal<string | null>(null);
  /** Başarı bildirimi (onaylanan hareket sayısıyla). */
  readonly confirmSuccess = signal<string | null>(null);

  // ---- Türetilmiş ---------------------------------------------------------
  /** Önizlemedeki hareketler (yoksa boş dizi). */
  readonly transactions = computed<ParsedTxn[]>(
    () => this.preview()?.transactions ?? [],
  );
  /** Önizlemedeki uyarılar (placeholder mesajı dahil). */
  readonly warnings = computed<string[]>(() => this.preview()?.warnings ?? []);
  /** Bu ekstre daha önce yüklenmiş mi. */
  readonly alreadyUploaded = computed(
    () => this.preview()?.alreadyUploaded ?? false,
  );
  /** Önizlemede hiç hareket yok mu (boş-durum kararı). */
  readonly hasNoTransactions = computed(() => this.transactions().length === 0);

  /** Yükle aktif: dosya + kart + ay var, dosya geçerli, yükleme yok. */
  readonly canUpload = computed(
    () =>
      !this.uploading() &&
      this.file() !== null &&
      this.fileError() === null &&
      !!this.cardLast4() &&
      !!this.month(),
  );

  /**
   * Onayla aktif: önizleme var, onaylanacak hareket var, daha önce
   * yüklenmemiş ve onay devam etmiyor. (Boş/placeholder veya zaten yüklü
   * ekstre onaylanamaz.)
   */
  readonly canConfirm = computed(
    () =>
      !this.confirming() &&
      this.preview() !== null &&
      !this.hasNoTransactions() &&
      !this.alreadyUploaded(),
  );

  ngOnInit(): void {
    this.cardsSub = this.service.cards().subscribe({
      next: (c) => this.cards.set(c),
      error: () => this.cards.set([]),
    });
  }

  // ---- Form olayları -----------------------------------------------------

  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0] ?? null;
    // Aynı dosyayı tekrar seçebilmek için input'u temizle.
    input.value = '';

    // Yeni dosya seçilince eski önizleme/sonuç geçersiz → temizle.
    this.clearPreview();

    if (!picked) {
      this.file.set(null);
      this.fileError.set(null);
      return;
    }
    const error = this.validateFile(picked);
    this.fileError.set(error);
    // Geçersiz dosyayı da tut ki kullanıcı adını/hatayı görsün; canUpload
    // fileError nedeniyle false kalır.
    this.file.set(picked);
  }

  onCardChange(event: Event): void {
    this.cardLast4.set((event.target as HTMLSelectElement).value);
    this.clearPreview();
  }

  onMonthChange(month: string): void {
    this.month.set(month);
    this.clearPreview();
  }

  /** İstemci-taraflı doğrulama: izinli tip + ≤10MB. Hata yoksa null. */
  private validateFile(file: File): string | null {
    const ext = this.extensionOf(file.name);
    if (!ext || !STATEMENT_ALLOWED_EXTENSIONS.includes(ext)) {
      return 'İzin verilmeyen dosya tipi (Excel: .xlsx/.xls veya Word: .docx)';
    }
    if (file.size > STATEMENT_MAX_FILE_SIZE_BYTES) {
      return 'Dosya 10MB sınırını aşıyor';
    }
    return null;
  }

  private extensionOf(name: string): string | null {
    const dot = name.lastIndexOf('.');
    if (dot < 0 || dot === name.length - 1) {
      return null;
    }
    return name.substring(dot + 1).toLowerCase();
  }

  // ---- Yükleme (parse önizleme) ------------------------------------------

  upload(): void {
    if (!this.canUpload()) {
      return;
    }
    const file = this.file();
    if (!file) {
      return;
    }

    this.uploadSub?.unsubscribe();
    this.uploading.set(true);
    this.uploadError.set(null);
    // Önceki önizleme/onay sonucunu temizle (yeni parse partisi geliyor).
    this.preview.set(null);
    this.confirmError.set(null);
    this.confirmSuccess.set(null);

    this.uploadSub = this.service
      .upload(file, this.cardLast4(), this.month())
      .subscribe({
        next: (res) => {
          this.uploading.set(false);
          this.preview.set(res);
        },
        error: (err) => {
          this.uploading.set(false);
          this.uploadError.set(this.messageOf(err, 'Ekstre yüklenemedi.'));
        },
      });
  }

  // ---- Onay --------------------------------------------------------------

  confirm(): void {
    if (!this.canConfirm()) {
      return;
    }
    const batchRef = this.preview()?.batchRef;
    if (!batchRef) {
      return;
    }

    this.confirmSub?.unsubscribe();
    this.confirming.set(true);
    this.confirmError.set(null);
    this.confirmSuccess.set(null);

    this.confirmSub = this.service.confirm(batchRef).subscribe({
      next: (res) => {
        this.confirming.set(false);
        this.confirmSuccess.set(
          `${res.confirmed} hareket başarıyla kaydedildi.`,
        );
        // Başarı sonrası formu/önizlemeyi sıfırla (yeni ekstre için temiz başlangıç).
        this.resetForm();
      },
      error: (err) => {
        this.confirming.set(false);
        this.confirmError.set(this.messageOf(err, 'Onaylama başarısız oldu.'));
      },
    });
  }

  /** "İptal" — önizlemeyi ve onay durumunu temizler (form alanları kalır). */
  cancelPreview(): void {
    if (this.confirming()) {
      return;
    }
    this.clearPreview();
  }

  /** Önizleme + onay durum sinyallerini temizler (dosya/kart/ay korunur). */
  private clearPreview(): void {
    this.preview.set(null);
    this.uploadError.set(null);
    this.confirmError.set(null);
    this.confirmSuccess.set(null);
  }

  /** Başarılı onay sonrası: dosya seçimini ve önizlemeyi tamamen sıfırla. */
  private resetForm(): void {
    this.file.set(null);
    this.fileError.set(null);
    this.preview.set(null);
    this.uploadError.set(null);
    this.confirmError.set(null);
    // confirmSuccess korunur → kullanıcı başarı bildirimini görür.
  }

  /** Backend hata gövdesinden ({error,message}) anlaşılır Türkçe mesaj çıkarır. */
  private messageOf(err: unknown, fallback: string): string {
    const e = err as { error?: { message?: string }; status?: number };
    if (e?.error?.message) {
      return e.error.message;
    }
    if (e?.status === 0) {
      return 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.';
    }
    if (e?.status === 403) {
      return 'Bu işlem için yetkiniz yok.';
    }
    return `${fallback} Lütfen tekrar deneyin.`;
  }

  // ---- Şablon yardımcıları ----------------------------------------------

  cardOptionLabel(card: CardRef): string {
    const name = card.label || card.bank;
    return `****${card.last4} · ${name}`;
  }

  /** Byte → okunabilir boyut (KB/MB). */
  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

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

  /** Ham sayı → tr-TR "#.##0,00" (₺ eki opsiyonel). null → "—". */
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

  ngOnDestroy(): void {
    this.uploadSub?.unsubscribe();
    this.confirmSub?.unsubscribe();
    this.cardsSub?.unsubscribe();
  }
}
