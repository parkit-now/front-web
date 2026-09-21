import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type CashSession = components['schemas']['CashSessionDto'];
export type CashSessionChangesResponse =
  components['schemas']['CashSessionChangesResponseDto'];

const CHANGES_PAGE_SIZE = 500;

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

export async function listAllCashSessions(
  tenantId: string,
): Promise<CashSession[]> {
  const token = await bearer();
  const all: CashSession[] = [];
  let afterSeq = 0;

  while (true) {
    const params = new URLSearchParams({
      afterSeq: String(afterSeq),
      limit: String(CHANGES_PAGE_SIZE),
    });
    const page = await apiRequest<CashSessionChangesResponse>({
      method: 'GET',
      path: `/tenants/${encodeURIComponent(tenantId)}/cash-sessions/changes?${params.toString()}`,
      bearer: token,
    });

    const items = page.items ?? [];
    all.push(...items);
    if (items.length < CHANGES_PAGE_SIZE || page.maxSeq <= afterSeq) break;
    afterSeq = page.maxSeq;
  }

  return all;
}
