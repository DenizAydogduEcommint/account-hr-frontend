import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { ExpensesService } from '../../pages/expenses/expenses.service';
import { ServicesService } from '../../pages/services/services.service';
import { ServiceResponse } from '../../pages/services/services.models';
import {
  CURRENCY_OPTIONS,
  Currency,
} from '../invoice-upload/invoice-upload.models';
import {
  ExpenseCreateRequest,
  KNOWN_CARD_LAST4,
} from './expense-create.models';

/**
 * E3-06 — Manuel harcama satırı oluşturma modalı.
 *
 * Harcamalar ekranındaki (E3-03) "Yeni Satır Ekle" butonundan açılır. Kullanıcı
 * servis master listesinden bir servis seçer; Hizmet (servis adı, salt-okunur),
 * Sağlayıcı ve Kart seçili servisten ÖN-DOLDURULUR (kart 3 bilinen karttan biriyle
 * değiştirilebilir). Tarih ay seçiminden ön-dolu gelir. İstemci doğrulaması:
 * zorunlu alanlar + pozitif sayılar + e-posta formatı.
 *
 * Gönderim → POST /api/v1/expenses. Başarı: {@link created} yayınlanır (çağıran
 * listeyi + toplamları yeniler) ve modal kapanır. 400 → sunucu mesajı gösterilir.
 * Servis listesi boşsa /services ekranına yönlendiren ipucu gösterilir.
 */
@Component({
  selector: 'app-expense-create-modal',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './expense-create-modal.component.html',
  styleUrl: './expense-create-modal.component.scss',
})
export class ExpenseCreateModalComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly expenses = inject(ExpensesService);
  private readonly services = inject(ServicesService);

  /** Ön-dolu işlem tarihi ISO "YYYY-MM-DD" (seçili aydan türetilir). */
  @Input() defaultDate = '';

  /** Başarı — oluşturulan satırın id'sini yayınlar (çağıran listeyi yeniler). */
  @Output() created = new EventEmitter<number>();
  /** Modal kapatıldı (iptal ya da başarı sonrası). */
  @Output() closed = new EventEmitter<void>();

  private servicesSub?: Subscription;
  private teamsSub?: Subscription;
  private saveSub?: Subscription;

  // ---- Servis master listesi (dropdown) ----------------------------------
  readonly serviceList = signal<ServiceResponse[]>([]);
  readonly servicesLoading = signal(false);
  readonly servicesError = signal(false);

  // ---- Takım listesi (dropdown) ------------------------------------------
  readonly teamList = signal<{ id: number; name: string }[]>([]);

  // ---- Form durumu -------------------------------------------------------
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly currencyOptions = CURRENCY_OPTIONS;
  readonly cardOptions = KNOWN_CARD_LAST4;

  /** Seçili servis (ön-dolu Hizmet/Sağlayıcı için). */
  readonly selectedService = signal<ServiceResponse | null>(null);

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      serviceId: [null as number | null, [Validators.required]],
      transactionDate: [this.defaultDate, [Validators.required]],
      amount: [
        null as number | null,
        [Validators.required, Validators.min(0.01)],
      ],
      currency: ['TRY' as Currency, [Validators.required]],
      amountTry: [
        null as number | null,
        [Validators.required, Validators.min(0.01)],
      ],
      cardLast4: [''],
      usingTeamId: [null as number | null],
      purpose: [''],
      informational: [false],
    });

    this.fetchServices();
    this.fetchTeams();
  }

  private fetchTeams(): void {
    this.teamsSub?.unsubscribe();
    this.teamsSub = this.expenses.teams().subscribe({
      next: (teams) => this.teamList.set(teams),
      error: () => this.teamList.set([]),
    });
  }

  private fetchServices(): void {
    this.servicesSub?.unsubscribe();
    this.servicesLoading.set(true);
    this.servicesError.set(false);

    // Aktif servisler önce gelsin; tüm master listeyi çek (büyük sayfa).
    this.servicesSub = this.services
      .list({ size: 200, sort: 'name,asc' })
      .subscribe({
        next: (res) => {
          this.serviceList.set(res.content);
          this.servicesLoading.set(false);
        },
        error: () => {
          this.serviceList.set([]);
          this.servicesError.set(true);
          this.servicesLoading.set(false);
        },
      });
  }

  /** Servis listesi yüklü ama boş → kullanıcıyı Servisler ekranına yönlendir. */
  readonly serviceListEmpty = computed(
    () =>
      !this.servicesLoading() &&
      !this.servicesError() &&
      this.serviceList().length === 0,
  );

  // ---- Form olayları -----------------------------------------------------

  /** Servis seçilince Sağlayıcı + Kart ön-doldurulur; Hizmet salt-okunur gösterilir. */
  onServiceChange(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    const id = raw === '' ? null : Number(raw);
    this.form.patchValue({ serviceId: id });

    const svc = id == null ? null : this.serviceList().find((s) => s.id === id);
    this.selectedService.set(svc ?? null);

    if (svc) {
      // Kart + takımı servisten ön-doldur (kullanıcı değiştirebilir).
      this.form.patchValue({
        cardLast4: svc.cardLast4 ?? '',
        usingTeamId: svc.usingTeamId ?? null,
        purpose: svc.purpose ?? '',
        informational: svc.informational ?? false,
      });
    }
  }

  /** Seçili servisin birincil (yoksa ilk) e-postası — salt-okunur gösterim için. */
  readonly selectedServiceEmail = computed(() => {
    const svc = this.selectedService();
    if (!svc?.contacts || svc.contacts.length === 0) {
      return '';
    }
    const primary = svc.contacts.find((c) => c.primary);
    return (primary ?? svc.contacts[0]).email ?? '';
  });

  // ---- Gönderim ----------------------------------------------------------

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);

    const v = this.form.getRawValue();
    const req: ExpenseCreateRequest = {
      serviceId: Number(v.serviceId),
      transactionDate: v.transactionDate,
      amount: Number(v.amount),
      currency: v.currency as Currency,
      amountTry: Number(v.amountTry),
      cardLast4: v.cardLast4 ? String(v.cardLast4) : null,
      usingTeamId:
        v.usingTeamId == null || v.usingTeamId === ''
          ? null
          : Number(v.usingTeamId),
      purpose: v.purpose?.trim() ? v.purpose.trim() : null,
      informational: !!v.informational,
    };

    this.saveSub?.unsubscribe();
    this.saveSub = this.expenses.createExpense(req).subscribe({
      next: (row) => {
        this.submitting.set(false);
        this.created.emit(row.id);
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
    const e = err as {
      error?: { message?: string };
      status?: number;
    };
    if (e?.error?.message) {
      return e.error.message;
    }
    if (e?.status === 0) {
      return 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.';
    }
    return 'Kayıt başarısız oldu. Lütfen alanları kontrol edip tekrar deneyin.';
  }

  // ---- Şablon yardımcıları ----------------------------------------------

  /** Bir form kontrolü hatalı + dokunulmuş mu (satır içi hata gösterimi). */
  invalid(name: string): boolean {
    const c = this.form?.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  ngOnDestroy(): void {
    this.servicesSub?.unsubscribe();
    this.teamsSub?.unsubscribe();
    this.saveSub?.unsubscribe();
  }
}
