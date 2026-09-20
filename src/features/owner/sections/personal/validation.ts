/** Tope de la columna `users.email` (`@db.VarChar(255)`) y del DTO del alta. */
const EMAIL_MAX_LENGTH = 255;

/**
 * Formato de email. A propósito laxo: la verdad la tiene `@IsEmail()` del
 * backend, esto sólo evita el round-trip cuando falta el `@` o el dominio.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Misma normalización que `normalizeEmailField` del backend (trim +
 * minúsculas), así lo que se manda es lo mismo con lo que se busca la cuenta.
 */
export function normalizeStaffEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export interface StaffEmailResult {
  error?: string;
  email?: string;
}

/**
 * Valida el email del alta antes de mandarlo. Devuelve el mail ya normalizado
 * cuando pasa, para que el caller no tenga que volver a normalizarlo.
 */
export function validateStaffEmail(raw: string): StaffEmailResult {
  const email = normalizeStaffEmail(raw);

  if (email.length === 0) {
    return { error: 'Ingresá el email de la persona.' };
  }
  if (email.length > EMAIL_MAX_LENGTH) {
    return { error: `Máximo ${EMAIL_MAX_LENGTH} caracteres.` };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Email inválido.' };
  }
  return { email };
}

/** Habilita el submit sin pintar errores mientras el usuario tipea. */
export function canSubmitStaffEmail(raw: string): boolean {
  return normalizeStaffEmail(raw).length > 0;
}
