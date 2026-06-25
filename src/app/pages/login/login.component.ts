import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

/**
 * Giriş ekranı. E-posta + parola reactive form; başarılı login sonrası
 * returnUrl (yoksa /dashboard) adresine yönlendirir. 401'de satır içi hata.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** İstek devam ediyor mu? (buton disable + spinner) */
  readonly pending = signal(false);
  /** Satır içi hata mesajı (401 vb.). */
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => {
        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.pending.set(false);
        if (err?.status === 401) {
          this.errorMessage.set('E-posta veya parola hatalı');
        } else if (err?.status === 0) {
          this.errorMessage.set('Sunucuya ulaşılamıyor. Lütfen tekrar deneyin.');
        } else {
          this.errorMessage.set('Giriş yapılamadı. Lütfen tekrar deneyin.');
        }
      },
    });
  }

  /** Şablonda alan hata kontrolü için yardımcı. */
  hasError(field: 'email' | 'password'): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
}
