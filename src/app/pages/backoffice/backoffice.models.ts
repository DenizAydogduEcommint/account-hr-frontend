import { UserRole } from '../../core/auth/auth.models';

/**
 * E1-08 Backoffice (kullanıcı yönetimi) API tipleri — ADMIN-only.
 *
 * Backend sözleşmesi:
 *   GET   /api/v1/admin/users                 →  User[]
 *   POST  /api/v1/admin/users                 →  User (201). Hata: 409 (yinelenen e-posta), 400 (şifre<8/geçersiz)
 *   PATCH /api/v1/admin/users/{id}/password   →  200
 *   PATCH /api/v1/admin/users/{id}/role       →  User. Hata: 409 (son aktif admin korunması — Türkçe mesaj)
 *   PATCH /api/v1/admin/users/{id}/active     →  User. Hata: 409 (son aktif admin korunması — Türkçe mesaj)
 *
 * `role` değerleri auth modelindeki UserRole ile birebir aynı (ADMIN/ACCOUNTING/TEAM_MEMBER).
 * Yanıtta passwordHash YOKTUR.
 */

/** Backoffice listesindeki tek bir giriş kullanıcısı. */
export interface BackofficeUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  teamId: number | null;
  createdAt: string | null;
}

/** POST /admin/users gövdesi (yeni kullanıcı). */
export interface CreateUserRequest {
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
}

// ---- Türkçe rol etiketleri (UI gösterimi) --------------------------------

export const USER_ROLE_LABELS_TR: Record<UserRole, string> = {
  ADMIN: 'Yönetici',
  ACCOUNTING: 'Muhasebe',
  TEAM_MEMBER: 'Ekip Üyesi',
};

/** Seçim kutularında ve rozetlerde kullanılacak sabit rol sırası. */
export const USER_ROLE_OPTIONS: UserRole[] = [
  'ADMIN',
  'ACCOUNTING',
  'TEAM_MEMBER',
];

/** Yeni şifre / sıfırlama için asgari uzunluk (backend ile aynı). */
export const PASSWORD_MIN_LENGTH = 8;
