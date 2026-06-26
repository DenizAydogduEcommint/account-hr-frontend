import { CurrencyPipe } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AuthService } from '../../core/auth/auth.service';
import { emailListValidator } from './email-list.validator';
import {
  ACTIVE_STATE_LABELS_TR,
  ACTIVE_STATE_OPTIONS,
  ActiveState,
  CardRef,
  FREQUENCY_LABELS_TR,
  FREQUENCY_OPTIONS,
  Frequency,
  INVOICE_SOURCE_LABELS_TR,
  INVOICE_SOURCE_OPTIONS,
  ServiceRequest,
  ServiceResponse,
} from './services.models';
import { ServicesService } from './services.service';

/**
 * E3-02 Servisler ekranı — ödenen tüm servislerin master listesi yönetimi.
 *
 * - Sinyal tabanlı durum: rows, loading, error, filtre/arama.
 * - Filtre (aktiflik) + arama (isim/sağlayıcı, debounce) → backend re-query.
 * - Frekans + Aktiflik renkli rozet; tutar tr-TR; Türkçe UI.
 * - Ekle/Düzenle reactive form modal (çoklu e-posta + format doğrulama).
 * - Sert silme YOK → PATCH ile pasifleştirme.
 * - Yazma aksiyonları yalnızca ADMIN rolünde görünür.
 */
@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class ServicesComponent implements OnInit, OnDestroy {
  private readonly service = inject(ServicesService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  // ---- Liste durumu ------------------------------------------------------
  readonly rows = signal<ServiceResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);

  // ---- Filtre / arama ----------------------------------------------------
  readonly activeFilter = signal<ActiveState | ''>('');
  readonly searchTerm = signal('');
  private readonly search$ = new Subject<string>();
  private searchSub?: Subscription;
  private listSub?: Subscription;
  private saveSub?: Subscription;
  private toggleSub?: Subscription;
  private cardsSub?: Subscription;

  // ---- Referans veri -----------------------------------------------------
  readonly cards = signal<CardRef[]>([]);

  // ---- Sabit seçenek listeleri (şablon) ----------------------------------
  readonly activeStateOptions = ACTIVE_STATE_OPTIONS;
  readonly frequencyOptions = FREQUENCY_OPTIONS;
  readonly invoiceSourceOptions = INVOICE_SOURCE_OPTIONS;
  readonly activeStateLabels = ACTIVE_STATE_LABELS_TR;
  readonly frequencyLabels = FREQUENCY_LABELS_TR;
  readonly invoiceSourceLabels = INVOICE_SOURCE_LABELS_TR;

  // ---- Yetki -------------------------------------------------------------
  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'ADMIN');

  // ---- Modal / form ------------------------------------------------------
  readonly modalOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      providerName: [''],
      cardLast4: [''],
      frequency: ['MONTHLY' as Frequency],
      activeState: ['YES' as ActiveState],
      activeMonths: [''],
      approxAmountTry: [null as number | null],
      invoiceSource: ['' as '' | typeof INVOICE_SOURCE_OPTIONS[number]],
      purpose: [''],
      notes: [''],
      contacts: this.fb.array([this.newContact()]),
    });

    // Aramayı debounce + distinct ile backend'e bağla.
    this.searchSub = this.search$
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => this.fetch());

    this.cardsSub = this.service.cards().subscribe({
      next: (c) => this.cards.set(c),
      error: () => this.cards.set([]),
    });

    this.fetch();
  }

  get contacts(): FormArray {
    return this.form.get('contacts') as FormArray;
  }

  private newContact(email = '', source = '', primary = false): FormGroup {
    return this.fb.group({
      email: [email, [Validators.required, emailListValidator()]],
      source: [source],
      primary: [primary],
    });
  }

  addContact(): void {
    this.contacts.push(this.newContact());
  }

  removeContact(index: number): void {
    if (this.contacts.length > 1) {
      this.contacts.removeAt(index);
    }
  }

  // ---- Liste veri çekme --------------------------------------------------
  private fetch(): void {
    this.listSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);

    const active = this.activeFilter() || null;
    this.listSub = this.service
      .list({ active, q: this.searchTerm(), size: 100, sort: 'name,asc' })
      .subscribe({
        next: (res) => {
          this.rows.set(res.content);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  onActiveFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as ActiveState | '';
    this.activeFilter.set(value);
    this.fetch();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.search$.next(value);
  }

  // ---- Modal -------------------------------------------------------------
  openCreate(): void {
    this.editingId.set(null);
    this.saveError.set(null);
    this.form.reset({
      name: '',
      providerName: '',
      cardLast4: '',
      frequency: 'MONTHLY',
      activeState: 'YES',
      activeMonths: '',
      approxAmountTry: null,
      invoiceSource: '',
      purpose: '',
      notes: '',
    });
    this.setContacts([this.newContact()]);
    this.modalOpen.set(true);
  }

  openEdit(row: ServiceResponse): void {
    this.editingId.set(row.id);
    this.saveError.set(null);
    this.form.reset({
      name: row.name,
      providerName: row.providerName ?? '',
      cardLast4: row.cardLast4 ?? '',
      frequency: row.frequency ?? 'MONTHLY',
      activeState: row.activeState ?? 'YES',
      activeMonths: row.activeMonths ?? '',
      approxAmountTry: row.approxAmountTry,
      invoiceSource: row.invoiceSource ?? '',
      purpose: row.purpose ?? '',
      notes: row.notes ?? '',
    });
    const contactGroups =
      row.contacts && row.contacts.length > 0
        ? row.contacts.map((c) =>
            this.newContact(c.email, c.source ?? '', c.primary),
          )
        : [this.newContact()];
    this.setContacts(contactGroups);
    this.modalOpen.set(true);
  }

  private setContacts(groups: FormGroup[]): void {
    const arr = this.contacts;
    arr.clear();
    groups.forEach((g) => arr.push(g));
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);

    const v = this.form.getRawValue();
    const body: ServiceRequest = {
      name: v.name,
      providerName: v.providerName || null,
      cardLast4: v.cardLast4 || null,
      frequency: v.frequency || null,
      activeState: v.activeState || null,
      activeMonths: v.activeMonths || null,
      approxAmountTry:
        v.approxAmountTry === '' || v.approxAmountTry == null
          ? null
          : Number(v.approxAmountTry),
      invoiceSource: v.invoiceSource || null,
      purpose: v.purpose || null,
      notes: v.notes || null,
      contacts: (v.contacts as { email: string; source: string; primary: boolean }[])
        .filter((c) => c.email && c.email.trim())
        .map((c) => ({
          email: c.email.trim(),
          source: c.source || null,
          primary: c.primary,
        })),
    };

    const id = this.editingId();
    const req$ =
      id != null ? this.service.update(id, body) : this.service.create(body);

    // Devam eden tek mutasyon aboneliğini sakla → bileşen yok edilirse iptal
    // (post-destroy fetch/sinyal yan etkisini önler).
    this.saveSub?.unsubscribe();
    this.saveSub = req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.fetch();
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set(
          'Kayıt başarısız. Alanları kontrol edip tekrar deneyin.',
        );
      },
    });
  }

  // ---- Pasifleştir / aktifleştir ----------------------------------------
  toggleActive(row: ServiceResponse): void {
    const next: ActiveState = row.activeState === 'YES' ? 'NO' : 'YES';
    // Ayrı `toggleSub` kullan → eşzamanlı bir düzenleme-kaydetme (saveSub) ile
    // aktifleştir/pasifleştir birbirini iptal etmesin.
    this.toggleSub?.unsubscribe();
    this.toggleSub = this.service.setActive(row.id, next).subscribe({
      next: () => this.fetch(),
      error: () => this.fetch(),
    });
  }

  // ---- Şablon yardımcıları ----------------------------------------------
  cardLabel(card: CardRef): string {
    const name = card.label || card.bank;
    return `****${card.last4} · ${name}`;
  }

  activeBadgeClass(state: ActiveState | null): string {
    switch (state) {
      case 'YES':
        return 'badge badge--green';
      case 'NO':
        return 'badge badge--gray';
      default:
        return 'badge badge--orange';
    }
  }

  contactsSummary(row: ServiceResponse): string {
    if (!row.contacts || row.contacts.length === 0) {
      return '—';
    }
    return row.contacts.map((c) => c.email).join(', ');
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.listSub?.unsubscribe();
    this.saveSub?.unsubscribe();
    this.toggleSub?.unsubscribe();
    this.cardsSub?.unsubscribe();
  }
}
