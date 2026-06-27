import { Routes } from '@angular/router';

import { authGuard, landingGuard, roleGuard } from './core/auth/auth.guard';
import { LayoutComponent } from './layout/layout.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LoginComponent } from './pages/login/login.component';

export const routes: Routes = [
  // Herkese açık giriş ekranı.
  { path: 'login', component: LoginComponent },

  // Oturum gerektiren uygulama kabuğu (layout) ve alt sayfaları.
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      // İndeks: role göre açılış ekranına yönlendir (E3-08).
      // landingGuard her zaman bir UrlTree döndürür (ADMIN→dashboard,
      // ACCOUNTING→missing-invoices, ...), bu yüzden component'e fiilen
      // ulaşılmaz. Angular bir route'ta redirectTo + canActivate'i birlikte
      // KABUL ETMEZ (NG04014); o yüzden hedef olarak bir component veririz.
      {
        path: '',
        canActivate: [landingGuard],
        pathMatch: 'full',
        component: DashboardComponent,
      },
      { path: 'dashboard', component: DashboardComponent },
      {
        // Servisler ekranı 3 rol de okuyabilir (E3-08; backend GET /services
        // hasAnyRole ADMIN/ACCOUNTING/TEAM_MEMBER). Yazma aksiyonları
        // (oluştur/düzenle/aktiflik) ServicesComponent'te yalnızca ADMIN'e
        // görünür; backend yazmada ADMIN-only enforce eder.
        path: 'services',
        canActivate: [roleGuard(['ADMIN', 'ACCOUNTING', 'TEAM_MEMBER'])],
        loadComponent: () =>
          import('./pages/services/services.component').then(
            (m) => m.ServicesComponent,
          ),
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('./pages/expenses/expenses.component').then(
            (m) => m.ExpensesComponent,
          ),
      },
      {
        // Ekstre yükleme (E4-01) — banka ekstresini parse et, önizle, onayla.
        // Yalnızca ADMIN/ACCOUNTING; backend de aynı rolleri enforce eder.
        path: 'statements',
        canActivate: [roleGuard(['ADMIN', 'ACCOUNTING'])],
        loadComponent: () =>
          import('./pages/statements/statements.component').then(
            (m) => m.StatementsComponent,
          ),
      },
      {
        // Gelen Faturalar (E5-02) — Drive bekleyenler klasöründen ham faturaları
        // çek ve listele. Yalnızca ADMIN/ACCOUNTING; backend de aynı rolleri
        // enforce eder.
        path: 'incoming',
        canActivate: [roleGuard(['ADMIN', 'ACCOUNTING'])],
        loadComponent: () =>
          import('./pages/incoming/incoming.component').then(
            (m) => m.IncomingComponent,
          ),
      },
      {
        path: 'missing-invoices',
        loadComponent: () =>
          import('./pages/missing-invoices/missing-invoices.component').then(
            (m) => m.MissingInvoicesComponent,
          ),
      },
      {
        // Backoffice (E1-08) — giriş kullanıcılarının yönetimi. Yalnızca ADMIN;
        // backend de admin/users uçlarında ADMIN-only enforce eder.
        path: 'backoffice',
        canActivate: [roleGuard(['ADMIN'])],
        loadComponent: () =>
          import('./pages/backoffice/backoffice.component').then(
            (m) => m.BackofficeComponent,
          ),
      },
      {
        // 403 — erişim yok (rol guard yönlendirmesi). Oturum içi kabukta kalır.
        path: '403',
        loadComponent: () =>
          import('./pages/forbidden/forbidden.component').then(
            (m) => m.ForbiddenComponent,
          ),
      },
    ],
  },

  // Bilinmeyen route → indeks (landingGuard role uygun ekrana atar; oturum
  // yoksa authGuard login'e yönlendirir).
  { path: '**', redirectTo: '' },
];
