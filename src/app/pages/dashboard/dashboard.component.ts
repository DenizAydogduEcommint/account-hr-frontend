import { Component, OnInit, inject, signal } from '@angular/core';

import { ApiService } from '../../core/api.service';

type ApiState = 'loading' | 'up' | 'unreachable';

/**
 * Skeleton dashboard. On init it pings the backend /api/health and renders a
 * status card. It MUST degrade gracefully: if the backend is down the app still
 * runs and shows a red "API: unreachable" card instead of crashing.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly state = signal<ApiState>('loading');

  ngOnInit(): void {
    this.api.getHealth().subscribe({
      next: (health) => this.state.set(health.status === 'UP' ? 'up' : 'unreachable'),
      error: () => this.state.set('unreachable'),
    });
  }
}
