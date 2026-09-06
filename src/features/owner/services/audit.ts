import type { components, operations } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type AuditEvent = components['schemas']['AuditEventDto'];
export type PaginatedAudit = components['schemas']['PaginatedAuditDto'];

type AuditQuery = NonNullable<
  operations['entitiesListAudit']['parameters']['query']
>;

export type AuditSeverity = NonNullable<AuditQuery['severity']>;
/** Catálogo cerrado: un valor fuera de la lista responde 400, no lista vacía. */
export type AuditAction = NonNullable<AuditQuery['action']>;

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * Traza de auditoría de la sucursal, más reciente primero.
 *
 * Accesible a **cualquier miembro** de la sucursal, no solo al dueño.
 *
 * Registra cambios de configuración y ciclo de vida (ediciones de perfil,
 * toggles de métodos de pago, onboarding, revisión de eventos LPR, acciones de
 * admin). **No** registra pagos, entradas/salidas ni alertas por exceso de
 * tiempo: eso no existe en la base.
 *
 * `from`/`to` usan el mismo formato con offset explícito que métricas, y son
 * opcionales e independientes entre sí.
 */
export async function listAuditEvents(input: {
  tenantId: string;
  severity?: AuditSeverity;
  action?: AuditAction;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedAudit> {
  const params = new URLSearchParams();
  if (input.severity) params.set('severity', input.severity);
  if (input.action) params.set('action', input.action);
  if (input.from) params.set('from', input.from);
  if (input.to) params.set('to', input.to);
  if (input.page !== undefined) params.set('page', String(input.page));
  if (input.pageSize !== undefined)
    params.set('pageSize', String(input.pageSize));

  const qs = params.toString();
  return apiRequest<PaginatedAudit>({
    method: 'GET',
    path: `/tenants/${encodeURIComponent(input.tenantId)}/audit${qs ? `?${qs}` : ''}`,
    bearer: await bearer(),
  });
}
