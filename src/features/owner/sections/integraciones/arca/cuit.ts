/**
 * Validación de CUIT con dígito verificador (módulo 11), para el paso 1 del
 * wizard de vinculación de ARCA.
 *
 * DUPLICADA A PROPÓSITO con `backend/src/arca/arca-cuit.ts` (que a su vez
 * apunta acá en su comentario): esto es sólo el aviso temprano en el cliente,
 * antes de gastar un viaje de red. La regla que vale es la del backend, que
 * vuelve a validar en `POST /tenants/:tenantId/arca/account` y responde 422
 * `ARCA_CUIT_INVALID` si no coincide.
 *
 * `validateCuit` de `features/onboarding/validation.ts` NO se tocó: sólo
 * exige 11 dígitos (sin dígito verificador) y otras pantallas dependen de ese
 * comportamiento más laxo, así que sumarle el módulo 11 ahí arriesgaba romper
 * casos que hoy pasan con un CUIT bien formado pero no necesariamente real.
 */

/** Pesos del dígito verificador del CUIT/CUIL (módulo 11). */
const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/** Deja sólo los dígitos: acepta `20-12345678-3` y `20 12345678 3`. */
export function normalizeArcaCuit(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Valida un CUIT (con o sin guiones): 11 dígitos y dígito verificador
 * correcto.
 */
export function isValidArcaCuit(raw: string): boolean {
  const cuit = normalizeArcaCuit(raw);
  if (!/^\d{11}$/.test(cuit)) return false;

  const digits = [...cuit].map(Number);
  const sum = CUIT_WEIGHTS.reduce((acc, w, i) => acc + w * digits[i], 0);
  const mod = 11 - (sum % 11);
  // 11 → 0; 10 no es un verificador válido (ARCA reasigna el prefijo).
  const expected = mod === 11 ? 0 : mod;
  return expected !== 10 && expected === digits[10];
}

/** Mensaje de error del paso 1, o `null` si el CUIT es válido. */
export function validateArcaCuit(raw: string): string | null {
  const digits = normalizeArcaCuit(raw);
  if (!digits) return 'Ingresá el CUIT';
  if (!isValidArcaCuit(digits)) return 'El CUIT no es válido';
  return null;
}
