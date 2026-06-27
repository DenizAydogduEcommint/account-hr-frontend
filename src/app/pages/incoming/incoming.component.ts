import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { PageInfoComponent } from '../../shared/page-info/page-info.component';
import {
  IncomingInvoice,
  IncomingPullSummary,
  IncomingSource,
  IncomingStatus,
} from './incoming.models';
import { IncomingService } from './incoming.service';

/** Durum filtresi seçeneği (boş = tümü). */
interface StatusFilterOption {
  value: '' | IncomingStatus;
  label: string;
}

/**
 * E5-02 — Gelen Faturalar ekranı (Drive waiting pull).
 *
 * Akış:
 *  1) Açılışta gelen fatura listesi yüklenir (en yeni önce).
 *  2) "Drive'dan Çek" → POST /incoming/pull → özet satırı
 *     ("Çekilen: X · Yeni: Y · Atlanan: Z") gösterilir ve liste yenilenir.
 *  3) Durum filtresi (opsiyonel) seçilince liste o duruma göre yeniden yüklenir.
 *  4) Opsiyonel satır aksiyonu "Yoksay" (yalnızca NEW) → PATCH /incoming/{id}/ignore
 *     → liste yenilenir.
 *
 * Yetki: ADMIN / ACCOUNTING (route roleGuard + sidebar gizleme; backend gerçek
 * kapıdır). Sinyal tabanlı; OnDestroy'da tüm abonelikler iptal edilir.
 */
@Component({
  selector: 'app-incoming',
  standalone: true,
  imports: [PageInfoComponent],
  templateUrl: './incoming.component.html',
  styleUrl: './incoming.component.scss',
})
export class IncomingComponent implements OnInit, OnDestroy {
  /** Sayfa bilgi kartı madde listesi (apostroflar güvende olsun diye .ts'te). */
  readonly pageInfoItems: string[] = [
    "Çek düğmesine basarak Drive'daki yeni faturaları sisteme al",
    'Gelen faturaları ve durumlarını (Yeni / Eşleşti / Yoksayıldı) gör',
    'İlgisiz dosyaları Yoksay düğmesiyle bir kenara ayır',
  ];

  private readonly service = inject(IncomingService);

  private listSub?: Subscription;
  private pullSub?: Subscription;
  private ignoreSub?: Subscription;

  /** Durum filtresi seçenekleri (boş = tümü). */
  readonly statusOptions: StatusFilterOption[] = [
    { value: '', label: 'Tümü' },
    { value: 'NEW', label: 'Yeni' },
    { value: 'MATCHED', label: 'Eşleşti' },
    { value: 'IGNORED', label: 'Yoksayıldı' },
  ];

  // ---- Liste durumu ------------------------------------------------------
  /** Gelen fatura satırları (en yeni önce). */
  readonly items = signal<IncomingInvoice[]>([]);
  /** Liste yükleniyor mu. */
  readonly loading = signal(false);
  /** Liste yükleme hatası (anlaşılır Türkçe mesaj). */
  readonly listError = signal<string | null>(null);
  /** Seçili durum filtresi (boş = tümü). */
  readonly statusFilter = signal<'' | IncomingStatus>('');

  // ---- Çekme (pull) durumu -----------------------------------------------
  /** Çekme devam ediyor mu. */
  readonly pulling = signal(false);
  /** Çekme hatası (anlaşılır Türkçe mesaj). */
  readonly pullError = signal<string | null>(null);
  /** Son çekme özeti (null → henüz çekilmedi). */
  readonly pullSummary = signal<IncomingPullSummary | null>(null);

  // ---- Satır aksiyon durumu ----------------------------------------------
  /** Yoksay işlemi devam eden satırın id'si (yoksa null). */
  readonly ignoringId = signal<number | null>(null);
  /** Satır aksiyon hatası (anlaşılır Türkçe mesaj). */
  readonly actionError = signal<string | null>(null);

  // ---- Türetilmiş ---------------------------------------------------------
  /** Listede hiç kayıt yok mu (boş-durum kararı). */
  readonly isEmpty = computed(() => this.items().length === 0);

  ngOnInit(): void {
    this.loadList();
  }

  // ---- Liste yükleme -----------------------------------------------------

  private loadList(): void {
    this.listSub?.unsubscribe();
    this.loading.set(true);
    this.listError.set(null);

    const status = this.statusFilter() || undefined;
    this.listSub = this.service.list(status).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.items.set(rows);
      },
      error: (err) => {
        this.loading.set(false);
        this.items.set([]);
        this.listError.set(
          this.messageOf(err, 'Gelen faturalar yüklenemedi.'),
        );
      },
    });
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as
      | ''
      | IncomingStatus;
    this.statusFilter.set(value);
    this.loadList();
  }

  // ---- Çekme (pull) ------------------------------------------------------

  pull(): void {
    if (this.pulling()) {
      return;
    }
    this.pullSub?.unsubscribe();
    this.pulling.set(true);
    this.pullError.set(null);
    this.actionError.set(null);

    this.pullSub = this.service.pull().subscribe({
      next: (summary) => {
        this.pulling.set(false);
        this.pullSummary.set(summary);
        // Çekme sonrası listeyi (mevcut filtreyle) yeniden yükle.
        this.loadList();
      },
      error: (err) => {
        this.pulling.set(false);
        this.pullError.set(this.messageOf(err, 'Drive’dan çekme başarısız oldu.'));
      },
    });
  }

  // ---- Satır aksiyonu: Yoksay --------------------------------------------

  ignore(item: IncomingInvoice): void {
    if (item.status !== 'NEW' || this.ignoringId() !== null) {
      return;
    }
    this.ignoreSub?.unsubscribe();
    this.ignoringId.set(item.id);
    this.actionError.set(null);

    this.ignoreSub = this.service.ignore(item.id).subscribe({
      next: () => {
        this.ignoringId.set(null);
        // Güncel durumu yansıtmak için listeyi yeniden yükle.
        this.loadList();
      },
      error: (err) => {
        this.ignoringId.set(null);
        this.actionError.set(this.messageOf(err, 'Yoksayma başarısız oldu.'));
      },
    });
  }

  // ---- Şablon yardımcıları ----------------------------------------------

  /** Kaynak kodu → Türkçe etiket. */
  sourceLabel(source: IncomingSource): string {
    switch (source) {
      case 'DRIVE_WAITING':
        return 'Drive';
      case 'MAIL':
        return 'E-posta';
      default:
        return source;
    }
  }

  /** Durum kodu → Türkçe rozet etiketi. */
  statusLabel(status: IncomingStatus): string {
    switch (status) {
      case 'NEW':
        return 'Yeni';
      case 'MATCHED':
        return 'Eşleşti';
      case 'IGNORED':
        return 'Yoksayıldı';
      default:
        return status;
    }
  }

  /** Durum kodu → rozet CSS modifier sınıfı. */
  statusClass(status: IncomingStatus): string {
    switch (status) {
      case 'NEW':
        return 'badge--new';
      case 'MATCHED':
        return 'badge--matched';
      case 'IGNORED':
        return 'badge--ignored';
      default:
        return '';
    }
  }

  /**
   * ISO tarih/zaman damgası → tr-TR "DD.MM.YYYY". Saat içeren değerlerde
   * yalnızca tarih kısmı alınır. null/boş/geçersiz → "—" / ham değer.
   */
  formatDate(iso: string | null): string {
    if (!iso) {
      return '—';
    }
    // Tam zaman damgasından tarih kısmını ayıkla ("YYYY-MM-DDThh:mm" → "YYYY-MM-DD").
    const datePart = iso.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) {
      return iso;
    }
    const [y, m, d] = parts;
    return `${d}.${m}.${y}`;
  }

  ngOnDestroy(): void {
    this.listSub?.unsubscribe();
    this.pullSub?.unsubscribe();
    this.ignoreSub?.unsubscribe();
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
}
