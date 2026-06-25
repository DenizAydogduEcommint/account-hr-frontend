import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
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
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
    ],
  },

  // Bilinmeyen route → dashboard'a (oturum yoksa guard login'e atar).
  { path: '**', redirectTo: 'dashboard' },
];
