import type { components } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

type GeneratedAuditEvent = components['schemas']['AuditEventDto'];
export type CashSession = components['schemas']['CashSessionDto'];
export type AuditSeverity = GeneratedAuditEvent['severity'];

export type AuditEventMetadata = Record<string, unknown>;

/**
 * `metadata` se RE-DECLARA (por eso el `Omit`) en vez de intersecarse.
 *
 * El backend publica `metadata` como un objeto sin propiedades, y
 * openapi-typescript lo traduce a `Record<string, never>`: un objeto que sólo
 * puede estar VACÍO. Intersecarlo con `unknown` deja un tipo que rechaza
 * cualquier metadata real (`{ plate: 'ABC123' }` no es asignable a `never`).
 *
 * Acá la forma real es opaca a propósito — cada acción de auditoría trae la
 * suya y `auditUtils.ts` la lee campo por campo con guardas. Salió a la luz al
 * correr `make sync-types` contra el backend actual: el `api-types.ts`
 * commiteado era anterior a que `AuditEventDto` declarara `metadata`.
 */
export type AuditEvent = Omit<GeneratedAuditEvent, 'metadata'> & {
  metadata?: unknown;
};

export type ListAuditEventsParams = {
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

export async function listAuditEvents(
  tenantId: string,
  params: ListAuditEventsParams = {},
): Promise<AuditEvent[]> {
  const search = new URLSearchParams();
  search.set('limit', String(params.limit ?? 500));
  if (params.severity) {
    search.set('severity', params.severity);
  }

  return apiRequest<AuditEvent[]>({
    method: 'GET',
    path: `/tenants/${tenantId}/audit?${search.toString()}`,
    bearer: await bearer(),
  });
}

export async function listCashSessions(
  tenantId: string,
): Promise<CashSession[]> {
  return apiRequest<CashSession[]>({
    method: 'GET',
    path: `/tenants/${tenantId}/cash-sessions`,
    bearer: await bearer(),
  });
}
