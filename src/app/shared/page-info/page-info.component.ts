import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  signal,
} from '@angular/core';

/**
 * Yeniden kullanılabilir "sayfa bilgi kartı".
 *
 * Her ana sayfanın üstüne konur; sayfanın ne işe yaradığını hiçbir şey
 * bilmeyen birinin bile anlayacağı şekilde dostça anlatır.
 *
 * - Sunumsal (presentational) bileşen — hiçbir servis çağrısı yok.
 * - Bilgi rengi (#3B82F6) sol kenar vurgusu + hafif mavi tint arka plan.
 * - Kapatılabilir: "×" ile kapatılır, durum localStorage'a yazılır
 *   (`pageinfo_dismissed_<storageKey>`). Kapatılınca yerine küçük
 *   "ℹ️ Bu sayfa nedir?" düğmesi gelir; tıklanınca kart yeniden açılır
 *   ve bayrak temizlenir.
 * - localStorage erişimi try/catch ile korunur (asla çökmemeli).
 *
 * Diğer sayfalar AYNEN bu deseni izlemeli (referans bileşen).
 */
@Component({
  selector: 'app-page-info',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!dismissed()) {
      <div class="page-info" role="note" [attr.aria-label]="title + ' — sayfa bilgisi'">
        <span class="page-info__icon" aria-hidden="true">ℹ️</span>

        <div class="page-info__body">
          <p class="page-info__title">{{ title }}</p>
          <p class="page-info__desc">{{ description }}</p>

          @if (items.length) {
            <ul class="page-info__list">
              @for (item of items; track item) {
                <li class="page-info__item">{{ item }}</li>
              }
            </ul>
          }
        </div>

        <button
          type="button"
          class="page-info__close"
          (click)="dismiss()"
          aria-label="Bilgi kartını kapat"
        >
          &times;
        </button>
      </div>
    } @else {
      <button
        type="button"
        class="page-info__reopen"
        (click)="reopen()"
        aria-label="Sayfa bilgisini göster"
      >
        ℹ️ Bu sayfa nedir?
      </button>
    }
  `,
  styles: [
    `
      @use 'styles/tokens' as *;

      // Bilgi rengi (AwesomeDesign info) — token setinde yok, literal kullanılıyor.
      $info: #3b82f6;
      $info-tint: rgba(59, 130, 246, 0.08);

      :host {
        display: block;
        margin-bottom: $space-3;
      }

      .page-info {
        display: flex;
        align-items: flex-start;
        gap: $space-2;
        background: $info-tint;
        border: 1px solid rgba(59, 130, 246, 0.18);
        border-left: 4px solid $info;
        border-radius: $radius-card;
        box-shadow: $shadow-sm;
        padding: $space-2 $space-3;

        &__icon {
          flex: 0 0 auto;
          font-size: 20px;
          line-height: 1.4;
        }

        &__body {
          flex: 1 1 auto;
          min-width: 0;
        }

        &__title {
          margin: 0 0 4px;
          font-size: 15px;
          font-weight: 700;
          color: $ec-text;
        }

        &__desc {
          margin: 0;
          font-size: 13px;
          line-height: 1.55;
          color: rgba(34, 34, 34, 0.75);
        }

        &__list {
          margin: $space-1 0 0;
          padding: 0 0 0 18px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        &__item {
          font-size: 13px;
          line-height: 1.5;
          color: rgba(34, 34, 34, 0.75);
        }

        &__close {
          flex: 0 0 auto;
          appearance: none;
          border: none;
          background: transparent;
          color: rgba(34, 34, 34, 0.45);
          font-size: 22px;
          line-height: 1;
          width: 28px;
          height: 28px;
          border-radius: $radius-input;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;

          &:hover {
            background: rgba(59, 130, 246, 0.12);
            color: $info;
          }

          &:focus-visible {
            outline: none;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
          }
        }
      }

      .page-info__reopen {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid rgba(59, 130, 246, 0.25);
        background: $info-tint;
        color: $info;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        padding: 6px 12px;
        border-radius: $radius-input;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease;

        &:hover {
          background: rgba(59, 130, 246, 0.14);
          border-color: $info;
        }

        &:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
        }
      }

      @media (max-width: 768px) {
        .page-info {
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class PageInfoComponent implements OnInit {
  /** Sayfa başına benzersiz anahtar (ör. 'dashboard'). localStorage için. ZORUNLU. */
  @Input({ required: true }) storageKey!: string;

  /** Kart başlığı (kalın). */
  @Input() title = '';

  /** Açıklama paragrafı. */
  @Input() description = '';

  /** "Ne yaparsın" madde listesi (opsiyonel). */
  @Input() items: string[] = [];

  /** Kart kapatıldı mı? localStorage'tan okunur. */
  readonly dismissed = signal(false);

  private get key(): string {
    return `pageinfo_dismissed_${this.storageKey}`;
  }

  ngOnInit(): void {
    this.dismissed.set(this.readDismissed());
  }

  /** Kartı kapat + localStorage'a yaz. */
  dismiss(): void {
    this.dismissed.set(true);
    this.writeDismissed(true);
  }

  /** Kartı yeniden aç + localStorage bayrağını temizle. */
  reopen(): void {
    this.dismissed.set(false);
    this.writeDismissed(false);
  }

  /** localStorage'tan kapatılma durumunu güvenle okur. */
  private readDismissed(): boolean {
    try {
      return localStorage.getItem(this.key) === '1';
    } catch {
      return false;
    }
  }

  /** localStorage'a güvenle yazar/temizler (asla çökmemeli). */
  private writeDismissed(value: boolean): void {
    try {
      if (value) {
        localStorage.setItem(this.key, '1');
      } else {
        localStorage.removeItem(this.key);
      }
    } catch {
      // sessizce yut — bilgi kartı kritik değil
    }
  }
}
