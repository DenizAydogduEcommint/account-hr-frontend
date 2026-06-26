/**
 * Uygulama genelinde paylaşılan varsayılan ay ("YYYY-MM").
 *
 * Tek kaynak (single source of truth): Dashboard, Expenses ve month-selector
 * bunu kullanır — böylece açılışta dropdown'da GÖSTERİLEN ay ile SORGULANAN ay
 * her zaman aynıdır.
 *
 * Geçerli tarihten dinamik hesaplanır (içinde bulunulan ay) → uygulama hangi
 * yıl/ayda açılırsa açılsın o ay seçili gelir; sabit bir geçmiş aya kilitlenmez.
 */
const _now = new Date();
export const DEFAULT_MONTH = `${_now.getFullYear()}-${String(
  _now.getMonth() + 1,
).padStart(2, '0')}`;
