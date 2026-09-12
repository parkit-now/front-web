import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

type GeneratedAuditEvent = components['schemas']['AuditEventDto'];
export type PaginatedAudit = components['schemas']['PaginatedAuditDto'];
export type AuditSeverity = GeneratedAuditEvent['severity'];

export type AuditEventMetadata = Record<string, unknown>;

export type AuditEvent = GeneratedAuditEvent & {
  metadata?: unknown;
};

// Las cajas se piden por `services/cash-sessions.ts`, que es el mismo endpoint
// y además acepta `limit`. Se re-exporta para no cambiar los imports de la
// página de auditoría.
export { listCashSessions } from './cash-sessions';
export type { CashSession } from './cash-sessions';

/** Tope de página del backend: pedir más devuelve 400. */
const AUDIT_PAGE_SIZE = 100;
const AUDIT_MAX_ITEMS = 500;

export type ListAuditEventsParams = {
  /**
   * Techo de eventos a traer, no un query param: se pagina de a
   * `AUDIT_PAGE_SIZE` hasta alcanzarlo.
   */
  limit?: number;
  severity?: AuditSeverity;
};

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * Traza de auditoría de la sucursal, más reciente primero. Accesible a
 * cualquier miembro, no solo al dueño.
 *
 * El endpoint es **paginado** (`{ items, page, pageSize, total }`) y su
 * `pageSize` está topeado en 100, así que se recorren páginas hasta `limit` —
 * el mismo patrón que `listDismissedLprEventsForAudit` usa para los eventos LPR
 * en `AuditoriaPage.tsx`. La página filtra y pagina en cliente sobre el
 * resultado, por eso se devuelve un array plano.
 */
export async function listAuditEvents(
  tenantId: string,
  params: ListAuditEventsParams = {},
): Promise<AuditEvent[]> {
  const maxItems = params.limit ?? AUDIT_MAX_ITEMS;
  const token = await bearer();

  const fetchPage = (page: number) => {
    const search = new URLSearchParams();
    search.set('page', String(page));
    search.set('pageSize', String(AUDIT_PAGE_SIZE));
    if (params.severity) {
      search.set('severity', params.severity);
    }

    return apiRequest<PaginatedAudit>({
      method: 'GET',
      path: `/tenants/${tenantId}/audit?${search.toString()}`,
      bearer: token,
    });
  };

  const firstPage = await fetchPage(1);
  const items = [...firstPage.items];
  const pageCount = Math.min(
    Math.ceil(firstPage.total / AUDIT_PAGE_SIZE),
    Math.ceil(maxItems / AUDIT_PAGE_SIZE),
  );

  for (let page = 2; page <= pageCount; page += 1) {
    const nextPage = await fetchPage(page);
    items.push(...nextPage.items);
  }

  return items.slice(0, maxItems);
}
