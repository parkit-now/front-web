import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type CashSession = components['schemas']['CashSessionDto'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * GET /tenants/:tenantId/cash-sessions — los turnos de caja, más recientes
 * primero. Solo hace falta membresía del tenant, no rol de owner.
 *
 * Sin `limit` el backend devuelve los 100 más recientes (antes devolvía el
 * historial completo). También acepta `from`/`to` por solapamiento, que acá no
 * hacen falta.
 *
 * `limit` se arma a mano: el OpenAPI lo publica como `Object` porque al DTO del
 * backend le falta el `type` en `@ApiPropertyOptional`, aunque valida un entero
 * entre 1 y 500.
 */
export async function listCashSessions(
  tenantId: string,
  options: { limit?: number } = {},
): Promise<CashSession[]> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  const qs = params.toString();

  return apiRequest<CashSession[]>({
    method: 'GET',
    path: `/tenants/${encodeURIComponent(tenantId)}/cash-sessions${qs ? `?${qs}` : ''}`,
    bearer: await bearer(),
  });
}
