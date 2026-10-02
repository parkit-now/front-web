import { ApiError } from '../../../lib/api/client';
import { PHONE_INVALID_MESSAGE } from './phoneUtils';

/**
 * Mensaje en español si el 400 del backend rechazó el campo `phone`
 * (`validationsErrors[].field === 'phone'`), o `null` si el error es otro.
 */
export function phoneFieldError(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.problem) return null;
  if (!('validationsErrors' in error.problem)) return null;
  const items = error.problem.validationsErrors;
  if (!Array.isArray(items)) return null;
  const hit = items.some(
    (item) => item.field === 'phone' || item.field.endsWith('.phone'),
  );
  return hit ? PHONE_INVALID_MESSAGE : null;
}
