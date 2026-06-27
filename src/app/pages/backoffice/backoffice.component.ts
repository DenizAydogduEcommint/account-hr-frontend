import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Subscription } from 'rxjs';

import { UserRole } from '../../core/auth/auth.models';
import { PageInfoComponent } from '../../shared/page-info/page-info.component';
import {
  BackofficeUser,
  CreateUserRequest,
  PASSWORD_MIN_LENGTH,
  USER_ROLE_LABELS_TR,
  USER_ROLE_OPTIONS,
} from './backoffice.models';
import { BackofficeService } from './backoffice.service';

/**
 * İki şifre alanının (şifre + tekrar) eşleşmesini doğrulayan grup-seviyesi
 * validatör. Eşleşmezse grup üzerine `passwordMismatch` hatası koyar.
 * Boş alanlar tekil `required`/`minlength` validatörlerine bırakılır.
 */
function passwordsMatchValidator(
  group: AbstractControl,
): ValidationErrors | null {
  const password = group.get('password')?.value ?? '';
  const confirm = group.get('passwordConfirm')?.value ?? '';
  if (!password || !confirm) {
    return null;
  }
  return password === confirm ? null : { passwordMismatch: true };
}

/**
 * E1-08 Backoffice — giriş kullanıcılarının yönetimi (ADMIN-only).
 *
 * - Sinyal tabanlı durum: rows, loading, error.
 * - Yeni kullanıcı ekle (e-posta, ad soyad, rol, çift şifre) → POST.
 * - Satır aksiyonları: şifre sıfırla (çift şifre modal), yetki değiştir
 *   (select → PATCH), aktif/pasif toggle (PATCH).
 * - Çift şifre girişi (şifre + tekrar) eşleşme doğrulaması + her alanda
 *   göster/gizle göz toggle'ı; yalnızca eşleşen şifre backend'e gider.
 * - 409 (yinelenen e-posta / son aktif admin korunması) backend'in Türkçe
 *   mesajı inline gösterilir; bileşen asla çökmez.
 *
 * Yetki: yalnızca ADMIN (route roleGuard + sidebar gizleme; backend gerçek
 * kapıdır). OnDestroy'da tüm abonelikler iptal edilir.
 */
@Component({
  selector: 'app-backoffice',
  standalone: true,
  imports: [ReactiveFormsModule, PageInfoComponent],
  templateUrl: './backoffice.component.html',
  styleUrl: './backoffice.component.scss',
})
export class BackofficeComponent implements OnInit, OnDestroy {
  /** Sayfa bilgi kartı madde listesi (apostroflar güvende olsun diye .ts'te). */
  readonly pageInfoItems: string[] = [
    'Yeni kullanıcı ekle ve yetki tipini seç (Yönetici / Muhasebe / Ekip Üyesi)',
    'Bir kullanıcının şifresini sıfırla',
    'Kullanıcının yetkisini değiştir veya hesabını pasif yap',
  ];

  private readonly service = inject(BackofficeService);
  private readonly fb = inject(FormBuilder);

  // ---- Sabitler (şablon) -------------------------------------------------
  readonly roleOptions = USER_ROLE_OPTIONS;
  readonly roleLabels = USER_ROLE_LABELS_TR;
  readonly passwordMinLength = PASSWORD_MIN_LENGTH;

  // ---- Liste durumu ------------------------------------------------------
  readonly rows = signal<BackofficeUser[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  /** Satır-içi aksiyon hatası (yetki/aktiflik) — id → mesaj. */
  readonly rowError = signal<{ id: number; message: string } | null>(null);
  /** Hangi satırda bir aksiyon (yetki/aktiflik) devam ediyor. */
  readonly busyRowId = signal<number | null>(null);

  private listSub?: Subscription;
  private createSub?: Subscription;
  private resetSub?: Subscription;
  private roleSub?: Subscription;
  private activeSub?: Subscription;

  // ---- Yeni kullanıcı modalı ---------------------------------------------
  readonly createOpen = signal(false);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  /** Şifre alanlarının görünürlüğü (göz toggle). */
  readonly createPwVisible = signal(false);
  readonly createPwConfirmVisible = signal(false);
  createForm!: FormGroup;

  // ---- Şifre sıfırlama modalı --------------------------------------------
  readonly resetOpen = signal(false);
  readonly resetting = signal(false);
  readonly resetError = signal<string | null>(null);
  readonly resetTarget = signal<BackofficeUser | null>(null);
  readonly resetPwVisible = signal(false);
  readonly resetPwConfirmVisible = signal(false);
  resetFormGroup!: FormGroup;

  ngOnInit(): void {
    this.createForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        fullName: ['', [Validators.required, Validators.maxLength(255)]],
        role: ['TEAM_MEMBER' as UserRole, [Validators.required]],
        password: [
          '',
          [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
        ],
        passwordConfirm: ['', [Validators.required]],
      },
      { validators: passwordsMatchValidator },
    );

    this.resetFormGroup = this.fb.group(
      {
        password: [
          '',
          [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
        ],
        passwordConfirm: ['', [Validators.required]],
      },
      { validators: passwordsMatchValidator },
    );

    this.fetch();
  }

  // ---- Liste veri çekme --------------------------------------------------
  private fetch(): void {
    this.listSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.rowError.set(null);

    this.listSub = this.service.list().subscribe({
      next: (res) => {
        this.rows.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  // ---- Yeni kullanıcı modalı ---------------------------------------------
  openCreate(): void {
    this.createError.set(null);
    this.createPwVisible.set(false);
    this.createPwConfirmVisible.set(false);
    this.createForm.reset({
      email: '',
      fullName: '',
      role: 'TEAM_MEMBER',
      password: '',
      passwordConfirm: '',
    });
    this.createOpen.set(true);
  }

  closeCreate(): void {
    if (this.creating()) {
      return;
    }
    this.createOpen.set(false);
  }

  create(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const v = this.createForm.getRawValue();
    const payload: CreateUserRequest = {
      email: (v.email as string).trim(),
      fullName: (v.fullName as string).trim(),
      role: v.role as UserRole,
      // Yalnızca eşleşen şifre gönderilir (confirm gönderilmez).
      password: v.password as string,
    };

    this.createSub?.unsubscribe();
    this.creating.set(true);
    this.createError.set(null);

    this.createSub = this.service.create(payload).subscribe({
      next: () => {
        this.creating.set(false);
        this.createOpen.set(false);
        this.fetch();
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(
          this.messageOf(
            err,
            'Kullanıcı oluşturulamadı.',
            'Bu e-posta adresi zaten kayıtlı.',
          ),
        );
      },
    });
  }

  // ---- Şifre sıfırlama modalı --------------------------------------------
  openReset(user: BackofficeUser): void {
    this.resetTarget.set(user);
    this.resetError.set(null);
    this.resetPwVisible.set(false);
    this.resetPwConfirmVisible.set(false);
    this.resetFormGroup.reset({ password: '', passwordConfirm: '' });
    this.resetOpen.set(true);
  }

  closeReset(): void {
    if (this.resetting()) {
      return;
    }
    this.resetOpen.set(false);
    this.resetTarget.set(null);
  }

  reset(): void {
    const target = this.resetTarget();
    if (!target || this.resetFormGroup.invalid) {
      this.resetFormGroup.markAllAsTouched();
      return;
    }
    const password = this.resetFormGroup.getRawValue().password as string;

    this.resetSub?.unsubscribe();
    this.resetting.set(true);
    this.resetError.set(null);

    this.resetSub = this.service.resetPassword(target.id, password).subscribe({
      next: () => {
        this.resetting.set(false);
        this.resetOpen.set(false);
        this.resetTarget.set(null);
      },
      error: (err) => {
        this.resetting.set(false);
        this.resetError.set(this.messageOf(err, 'Şifre sıfırlanamadı.'));
      },
    });
  }

  // ---- Yetki değiştir ----------------------------------------------------
  onRoleChange(user: BackofficeUser, event: Event): void {
    const next = (event.target as HTMLSelectElement).value as UserRole;
    if (next === user.role) {
      return;
    }
    this.roleSub?.unsubscribe();
    this.busyRowId.set(user.id);
    this.rowError.set(null);

    this.roleSub = this.service.changeRole(user.id, next).subscribe({
      next: () => {
        this.busyRowId.set(null);
        this.fetch();
      },
      error: (err) => {
        this.busyRowId.set(null);
        // 409: son aktif admin korunması — backend'in Türkçe mesajını göster.
        this.rowError.set({
          id: user.id,
          message: this.messageOf(err, 'Yetki değiştirilemedi.'),
        });
        // Listeyi tazeleyerek select'i gerçek role geri çevir.
        this.fetch();
      },
    });
  }

  // ---- Aktif / pasif -----------------------------------------------------
  toggleActive(user: BackofficeUser): void {
    const next = !user.active;
    this.activeSub?.unsubscribe();
    this.busyRowId.set(user.id);
    this.rowError.set(null);

    this.activeSub = this.service.setActive(user.id, next).subscribe({
      next: () => {
        this.busyRowId.set(null);
        this.fetch();
      },
      error: (err) => {
        this.busyRowId.set(null);
        // 409: son aktif admin korunması — backend'in Türkçe mesajını göster.
        this.rowError.set({
          id: user.id,
          message: this.messageOf(err, 'Durum değiştirilemedi.'),
        });
      },
    });
  }

  // ---- Şablon yardımcıları ----------------------------------------------

  /** Aktiflik rozeti rengi. */
  activeBadgeClass(active: boolean): string {
    return active ? 'badge badge--green' : 'badge badge--gray';
  }

  /** ISO tarih/zaman → tr-TR "GG.AA.YYYY"; null/boş → "—". */
  formatDate(iso: string | null): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** Bu satırda gösterilecek aksiyon hatası (yoksa null). */
  rowErrorFor(id: number): string | null {
    const e = this.rowError();
    return e && e.id === id ? e.message : null;
  }

  /**
   * Backend hata gövdesinden ({error,message}) anlaşılır Türkçe mesaj çıkarır.
   * 409'da `conflictFallback` verilmişse onu kullanır (mesaj yoksa).
   */
  private messageOf(
    err: unknown,
    fallback: string,
    conflictFallback?: string,
  ): string {
    const e = err as { error?: { message?: string }; status?: number };
    if (e?.error?.message) {
      return e.error.message;
    }
    if (e?.status === 409 && conflictFallback) {
      return conflictFallback;
    }
    if (e?.status === 400) {
      return 'Girdiğiniz bilgiler geçersiz. Lütfen kontrol edin.';
    }
    if (e?.status === 0) {
      return 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.';
    }
    if (e?.status === 403) {
      return 'Bu işlem için yetkiniz yok.';
    }
    return `${fallback} Lütfen tekrar deneyin.`;
  }

  ngOnDestroy(): void {
    this.listSub?.unsubscribe();
    this.createSub?.unsubscribe();
    this.resetSub?.unsubscribe();
    this.roleSub?.unsubscribe();
    this.activeSub?.unsubscribe();
  }
}
