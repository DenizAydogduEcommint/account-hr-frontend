/**
 * Uygulama genelinde paylaşılan varsayılan ay ("YYYY-MM").
 *
 * Tek kaynak (single source of truth): Dashboard, Expenses ve month-selector
 * bunu kullanır — böylece açılışta dropdown'da GÖSTERİLEN ay ile SORGULANAN ay
 * her zaman aynıdır.
 *
 * Veri 2026-01..2026-04 aralığında var; varsayılan, son tam dolu ay olan
 * Mart (2026-03) seçilir ki açılışta tablo boş gelmesin.
 */
export const DEFAULT_MONTH = '2026-03';
