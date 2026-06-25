/**
 * account-hr kimlik doğrulama (auth) tipleri.
 *
 * Backend sözleşmesiyle BİREBİR uyumludur (E1-03):
 *   POST /auth/login    → AuthResponse
 *   POST /auth/refresh  → AuthResponse (yeni access + rotate edilmiş refresh)
 *   POST /auth/logout   → 204
 *   GET  /auth/me       → AuthUser
 */

/** Kullanıcı rolleri — backend enum ile aynı (ROLE_ önekleri olmadan). */
export type UserRole = 'ADMIN' | 'ACCOUNTING' | 'TEAM_MEMBER';

/** POST /auth/login gövdesi. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** POST /auth/refresh gövdesi. */
export interface RefreshRequest {
  refreshToken: string;
}

/** POST /auth/logout gövdesi. */
export interface LogoutRequest {
  refreshToken: string;
}

/** Giriş yapan kullanıcı (login yanıtının `user` alanı ve /auth/me yanıtı). */
export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
}

/** /auth/login ve /auth/refresh ortak yanıt şekli. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}
