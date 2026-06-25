import {
  APP_INITIALIZER,
  ApplicationConfig,
  LOCALE_ID,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeTr from '@angular/common/locales/tr';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/auth/auth.interceptor';
import { httpErrorInterceptor } from './core/http-error.interceptor';

/**
 * Uygulama açılışında, saklı bir token varsa kullanıcıyı /auth/me ile geri
 * yükler. Hata olsa bile başlatmayı bloklamaz (oturumsuz devam eder).
 */
function restoreSessionFactory(auth: AuthService): () => Promise<void> {
  return () =>
    firstValueFrom(auth.restoreSession())
      .then(() => void 0)
      .catch(() => void 0);
}

// Türkçe yerel ayar (tr-TR): para birimi (₺), tarih, sayı biçimlendirmesi için.
registerLocaleData(localeTr, 'tr-TR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: LOCALE_ID, useValue: 'tr-TR' },
    provideRouter(routes),
    // Sıra önemli: istekte httpError → auth (auth sona yakın, 401'i ham
    // görüp refresh/retry yapabilsin); yanıtta ters yönde işlenir.
    provideHttpClient(withInterceptors([httpErrorInterceptor, authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: restoreSessionFactory,
      deps: [AuthService],
      multi: true,
    },
  ],
};
