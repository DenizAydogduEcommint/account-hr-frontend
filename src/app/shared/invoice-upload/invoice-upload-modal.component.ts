import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { MonthSelectorComponent } from '../month-selector/month-selector.component';
import {
  ALLOWED_EXTENSIONS,
  COMMON_KDV_RATES,
  CURRENCY_OPTIONS,
  Currency,
  MAX_FILE_SIZE_BYTES,
  ParsedInvoiceResponse,
} from './invoice-upload.models';
import { InvoiceUploadService } from './invoice-upload.service';

/** Kuyruktaki bir dosya: dosya + (varsa) istemci-taraflı doğrulama hatası. */
interface QueuedFile {
  file: File;
  error: string | null;
}

/**
 * E3-05 — Yeniden kullanılabilir Fatura Yükleme modalı.
 *
 * Eksik Fatura ekranındaki "Fatura Yükle" butonundan (servisId + ay ön-dolu) ya da
 * (ileride) harcama satırından açılır. Kullanıcı tutar/para birimi/açıklama girer,
 * e-Fatura işaretler ve bir veya birden çok dosyayı sürükle-bırak ya da dosya seçici
 * ile ekler. İstemci-taraflı tip (PDF/XML/JPG/PNG) + boyut (≤10MB) doğrulaması yapılır.
 *
 * Gönderim → multipart POST /api/v1/invoices. Başarı: {@link uploaded} yayınlanır
 * (çağıran listeyi + sayacı yeniler) ve modal kapanır. Hata: anlaşılır mesaj gösterilir,
 * hiçbir şey yarım kaydedilmez (atomiklik backend'de). Türkçe arayüz; tasarım sistemi.
 */
@Component({
  selector: 'app-invoice-upload-modal',
  standalone: true,
  imports: [MonthSelectorComponent],
  templateUrl: './invoice-upload-modal.component.html',
  styleUrl: './invoice-upload-modal.component.scss',
})
export class InvoiceUploadModalComponent implements OnDestroy {
  private readonly service = inject(InvoiceUploadService);

  /** Devam eden yükleme aboneliği; bileşen yok edilince iptal edilir. */
  private uploadSub?: Subscription;

  // ---- Otomatik fatura okuma (E5-03) ------------------------------------
  /** Devam eden parse aboneliği; yeni dosya seçilince / yok edilince iptal edilir. */
  private parseSub?: Subscription;
  /**
   * Bayat-yanıt koruması: her parse tetiklemesinde artar. Yanıt geldiğinde
   * yakalanan token güncel token ile eşleşmiyorsa (kullanıcı dosyayı değiştirmiş)
   * yanıt YOK SAYILIR — sıra-dışı (out-of-order) yanıtlar UI'ı bozmaz.
   */
  private parseToken = 0;

  /** Yüklenecek servisin id'si (eksik ekranından ön-dolu). */
  @Input({ required: true }) serviceId!: number;
  /** Servis adı (başlıkta gösterilir, salt-okunur). */
  @Input() serviceName = '';
  /** Ön-dolu ay ("YYYY-MM"). Signal ile tutulur ki canSubmit reaktif olsun. */
  readonly month = signal('');
  @Input('month') set monthInput(value: string) {
    this.month.set(value ?? '');
  }

  /**
   * Başarılı yükleme — çağıran listeyi/sayacı yeniler. Servis adını yayınlar
   * (çağıran başarı mesajında kullanır); yükleme yanıtı bileşen içinde kalır.
   */
  @Output() uploaded = new EventEmitter<string>();
  /** Modal kapatıldı (iptal ya da başarı sonrası). */
  @Output() closed = new EventEmitter<void>();

  // ---- Form durumu -------------------------------------------------------
  readonly amount = signal<number | null>(null);
  readonly currency = signal<Currency>('TRY');
  readonly description = signal('');
  readonly eInvoice = signal(false);
  readonly queue = signal<QueuedFile[]>([]);
  readonly dragging = signal(false);

  // ---- KDV (E3-11) -------------------------------------------------------
  /**
   * KDV oranı seçimi. Sentinel değerler:
   *   '' → KDV girme (varsayılan, hiç gönderilmez)
   *   'other' → "Diğer" serbest giriş aktif ({@link kdvRateOther} okunur)
   *   sayısal string ('0'|'1'|'10'|'20') → o oran.
   * Matrah/KDV tutarı SUNUCUDA hesaplanır; burada yalnızca oran toplanır.
   */
  readonly kdvSelection = signal<string>('');
  /** "Diğer" seçiliyken serbest girilen oran (yüzde). null → boş. */
  readonly kdvRateOther = signal<number | null>(null);
  /**
   * Kullanıcı KDV oranını ELLE değiştirdi mi? Parse otomatik-doldurması yalnızca
   * kullanıcı henüz dokunmadıysa uygulanır (kullanıcı seçimini ezmez).
   */
  private kdvTouched = false;

  // ---- Otomatik fatura okuma durumu (E5-03) -----------------------------
  /** Parse isteği devam ediyor mu? "Fatura okunuyor…" göstergesi. */
  readonly parsing = signal(false);
  /** Son başarılı parse sonucu (null → panel gizli). */
  readonly parsed = signal<ParsedInvoiceResponse | null>(null);
  /**
   * Parse sessizce başarısız oldu mu (ağ/400/500)? Yükleme akışını bloklamaz;
   * yalnızca küçük bir bilgi notu gösterilir.
   */
  readonly parseFailed = signal(false);

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly currencyOptions = CURRENCY_OPTIONS;
  readonly commonKdvRates = COMMON_KDV_RATES;

  /**
   * Gönderilecek efektif KDV oranı. Hiç (''), ya da "Diğer" seçili ama boş/geçersiz
   * (≤ negatif) ise null → istek gövdesinde omit edilir.
   */
  readonly effectiveKdvRate = computed<number | null>(() => {
    const sel = this.kdvSelection();
    if (sel === '') {
      return null;
    }
    if (sel === 'other') {
      const v = this.kdvRateOther();
      return v != null && v >= 0 ? v : null;
    }
    const n = Number(sel);
    return Number.isFinite(n) ? n : null;
  });

  /** Geçerli (hatasız) dosyalar var mı + tümü geçerli mi? Gönderim koşulu. */
  readonly validFiles = computed(() =>
    this.queue().filter((q) => q.error === null),
  );
  readonly hasInvalid = computed(() =>
    this.queue().some((q) => q.error !== null),
  );
  readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      this.validFiles().length > 0 &&
      !this.hasInvalid() &&
      !!this.month(),
  );

  // ---- Dosya kuyruğu yönetimi -------------------------------------------

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
    }
    // Aynı dosyayı tekrar seçebilmek için input'u temizle.
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (event.dataTransfer?.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  removeFile(index: number): void {
    this.queue.update((q) => q.filter((_, i) => i !== index));
  }

  private addFiles(files: File[]): void {
    const queued: QueuedFile[] = files.map((file) => ({
      file,
      error: this.validate(file),
    }));
    this.queue.update((q) => [...q, ...queued]);

    // E5-03: bu partideki son GEÇERLİ PDF'i otomatik oku. Birden çok dosya tek
    // seçimde gelirse en son PDF baz alınır (son seçim = niyet).
    const lastPdf = [...queued]
      .reverse()
      .find((q) => q.error === null && this.isPdf(q.file));
    if (lastPdf) {
      this.triggerParse(lastPdf.file);
    }
  }

  /** Dosya adı .pdf ile bitiyor mu (büyük/küçük harf duyarsız)? */
  private isPdf(file: File): boolean {
    return this.extensionOf(file.name) === 'pdf';
  }

  /**
   * E5-03: Bir PDF için otomatik okuma başlatır. Bayat yanıt koruması ({@link parseToken})
   * ile sıra-dışı yanıtlar yok sayılır. Hata SESSİZDİR — yükleme akışını bloklamaz.
   */
  private triggerParse(file: File): void {
    const token = ++this.parseToken;
    this.parseSub?.unsubscribe();
    this.parsing.set(true);
    this.parsed.set(null);
    this.parseFailed.set(false);

    this.parseSub = this.service.parse(file).subscribe({
      next: (res) => {
        // Bayat yanıt: kullanıcı bu arada dosyayı değiştirdi → yok say.
        if (token !== this.parseToken) {
          return;
        }
        this.parsing.set(false);
        this.parsed.set(res);
        this.applyParsedKdv(res);
      },
      error: () => {
        if (token !== this.parseToken) {
          return;
        }
        // Sessiz hata: panel yok, yalnızca küçük bilgi notu. Yükleme akışı bozulmaz.
        this.parsing.set(false);
        this.parsed.set(null);
        this.parseFailed.set(true);
      },
    });
  }

  /**
   * Okunan KDV oranını (varsa) oran kontrolüne ön-doldurur. Yalnızca kullanıcı
   * KDV'ye henüz ELLE dokunmadıysa uygulanır (kullanıcı seçimini ezmez).
   */
  private applyParsedKdv(res: ParsedInvoiceResponse): void {
    if (res.vatRate == null || this.kdvTouched) {
      return;
    }
    const rate = res.vatRate;
    if (COMMON_KDV_RATES.includes(rate)) {
      this.kdvSelection.set(String(rate));
      this.kdvRateOther.set(null);
    } else {
      // Listede olmayan oran → "Diğer" + serbest giriş.
      this.kdvSelection.set('other');
      this.kdvRateOther.set(rate);
    }
  }

  /** İstemci-taraflı doğrulama: izinli tip + ≤10MB. Hata yoksa null. */
  private validate(file: File): string | null {
    const ext = this.extensionOf(file.name);
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return 'İzin verilmeyen dosya tipi (PDF, XML, JPG, PNG)';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
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

  // ---- Form alanları -----------------------------------------------------

  onAmountInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.amount.set(value === '' ? null : Number(value));
  }

  onCurrencyChange(event: Event): void {
    this.currency.set((event.target as HTMLSelectElement).value as Currency);
  }

  onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
  }

  onEInvoiceChange(event: Event): void {
    this.eInvoice.set((event.target as HTMLInputElement).checked);
  }

  onKdvSelectionChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.kdvTouched = true; // Kullanıcı dokundu → otomatik-doldurma artık ezmez.
    this.kdvSelection.set(value);
    // "Diğer" dışına çıkılınca serbest girişi temizle (bayat değer sızmasın).
    if (value !== 'other') {
      this.kdvRateOther.set(null);
    }
  }

  onKdvRateOtherInput(event: Event): void {
    this.kdvTouched = true; // Kullanıcı dokundu → otomatik-doldurma artık ezmez.
    const value = (event.target as HTMLInputElement).value;
    this.kdvRateOther.set(value === '' ? null : Number(value));
  }

  onMonthChange(month: string): void {
    this.month.set(month);
  }

  // ---- Gönderim ----------------------------------------------------------

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);

    this.uploadSub?.unsubscribe();
    this.uploadSub = this.service
      .upload({
        serviceId: this.serviceId,
        month: this.month(),
        amount: this.amount(),
        currency: this.currency(),
        description: this.description() || null,
        eInvoice: this.eInvoice(),
        kdvRate: this.effectiveKdvRate(),
        files: this.validFiles().map((q) => q.file),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.uploaded.emit(this.serviceName);
        },
        error: (err) => {
          this.submitting.set(false);
          this.submitError.set(this.messageOf(err));
        },
      });
  }

  cancel(): void {
    if (this.submitting()) {
      return;
    }
    this.closed.emit();
  }

  /** Backend hata gövdesinden ({error,message}) anlaşılır Türkçe mesaj çıkarır. */
  private messageOf(err: unknown): string {
    const e = err as { error?: { message?: string }; status?: number };
    if (e?.error?.message) {
      return e.error.message;
    }
    if (e?.status === 0) {
      return 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.';
    }
    return 'Yükleme başarısız oldu. Lütfen tekrar deneyin.';
  }

  // ---- Şablon yardımcıları ----------------------------------------------

  ngOnDestroy(): void {
    // Devam eden yükleme/okuma varsa iptal et → bileşen yok edildikten sonra
    // sinyal yazımı / event yayını olmasın.
    this.uploadSub?.unsubscribe();
    this.parseSub?.unsubscribe();
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

  // ---- Okunan Bilgiler paneli (E5-03) görüntü yardımcıları ---------------

  /** YYYY-MM-DD → "DD.MM.YYYY" (tr-TR). null/geçersiz → "—". */
  formatParsedDate(iso: string | null): string {
    if (!iso) {
      return '—';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '—';
    }
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** Sayı → tr-TR "#.##0,00". null → "—". */
  formatParsedAmount(value: number | null): string {
    if (value == null) {
      return '—';
    }
    return value.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /** Düz metin alanı (Fatura No, Sağlayıcı, Para Birimi). null/boş → "—". */
  formatParsedText(value: string | null): string {
    return value && value.trim() ? value : '—';
  }

  /** Okunan KDV oranı+tutarı tek satırda: "%20 · 36,00" / "%20" / "36,00" / "—". */
  formatParsedVat(rate: number | null, amount: number | null): string {
    const parts: string[] = [];
    if (rate != null) {
      parts.push(`%${rate}`);
    }
    if (amount != null) {
      parts.push(this.formatParsedAmount(amount));
    }
    return parts.length ? parts.join(' · ') : '—';
  }
}
