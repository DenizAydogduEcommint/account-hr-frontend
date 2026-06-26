import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Virgülle ayrılmış bir veya birden çok e-posta adresini doğrular (E3-02 / E6).
 *
 * Backend {@code EmailList} kuralının ön yüz aynası: tek adres veya
 * "a@x.com, b@y.com" geçerli; her token ayrı doğrulanır. Boş token (baştaki/
 * sondaki/çift virgül) geçersizdir. Boş değer (zorunluluk ayrı `required` ile)
 * burada hata üretmez.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailListValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value == null || value === '') {
      return null;
    }
    const tokens = String(value).split(',');
    for (const token of tokens) {
      const trimmed = token.trim();
      if (trimmed === '' || !EMAIL_RE.test(trimmed)) {
        return { emailList: true };
      }
    }
    return null;
  };
}
