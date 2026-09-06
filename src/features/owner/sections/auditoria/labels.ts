import type { AuditAction, AuditSeverity } from '../../services/audit';

/**
 * Etiquetas en español del catálogo de acciones auditadas.
 *
 * Las claves son el enum del contrato: mandar una acción fuera de la lista
 * responde 400, no una lista vacía. Por eso el filtro es un select cerrado y
 * nunca texto libre.
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'application.created': 'creó una solicitud',
  'application.updated': 'editó una solicitud',
  'application.submitted': 'envió una solicitud',
  'application.document_added': 'adjuntó un documento',
  'application.rejected': 'rechazó una solicitud',
  'user.promoted_to_owner': 'fue promovido a dueño',
  'entity.approved': 'aprobó el estacionamiento',
  'entity.rejected': 'rechazó el estacionamiento',
  'entity.profile_updated': 'editó el perfil del estacionamiento',
  'payment_method.toggled': 'cambió un método de pago',
  'lpr_event.registered': 'registró una lectura de patente',
  'lpr_event.dismissed': 'descartó una lectura de patente',
  'lpr_event.suppressed': 'suprimió una lectura de patente',
  'lpr_event.archived': 'archivó una lectura de patente',
  'lpr_event.unarchived': 'desarchivó una lectura de patente',
  'lpr_event.image_purged': 'purgó la imagen de una lectura',
  'parking.created': 'creó un estacionamiento',
  'parking.updated': 'editó un estacionamiento',
  'parking.deleted': 'eliminó un estacionamiento',
  'user.role_updated': 'cambió el rol de un usuario',
  'user.deleted': 'eliminó un usuario',
  'membership.created': 'asignó a alguien a un estacionamiento',
  'membership.updated': 'cambió el rol de un miembro',
  'membership.deleted': 'quitó a alguien de un estacionamiento',
};

/**
 * El backend puede sumar acciones al catálogo antes de que se traduzcan acá:
 * en ese caso se muestra el código crudo en vez de romper la fila.
 */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action as AuditAction] ?? action;
}

/** El actor es `null` cuando la acción la emite el sistema, no una persona. */
export function auditActorLabel(actorName: string | null): string {
  return actorName ?? 'Sistema';
}

export const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  info: 'Info',
  warn: 'Advertencia',
  crit: 'Crítico',
};

export const SEVERITY_DOT_COLOR: Record<AuditSeverity, string> = {
  info: 'var(--brand)',
  warn: 'var(--warn-text)',
  crit: 'var(--err-text)',
};

/** Opciones del select de acciones, ordenadas alfabéticamente por etiqueta. */
export function auditActionOptions(): Array<{
  value: AuditAction;
  label: string;
}> {
  return (Object.keys(AUDIT_ACTION_LABELS) as AuditAction[])
    .map((value) => ({ value, label: AUDIT_ACTION_LABELS[value] }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}
