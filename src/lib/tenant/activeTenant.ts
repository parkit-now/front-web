/**
 * Estacionamiento activo del panel del dueño: resolución y persistencia.
 *
 * Vive acá, puro y sin React, porque el bug que arregla es de los que no se
 * ven en un test de componente: con una cuenta distinta en el mismo navegador,
 * el id guardado por la cuenta ANTERIOR se usaba como activo hasta que llegaba
 * `GET /tenants?role=owner`, y todas las queries del panel (metrics, revenue,
 * top-plates…) salían contra un tenant ajeno y volvían 403. Y como el valor
 * guardado nunca se corregía, se repetía en cada recarga.
 *
 * Tres reglas, todas acá:
 *  1. La key se scopea por usuario: el id de una cuenta no es el de otra.
 *  2. Un id guardado NO es el activo hasta validarlo contra la lista real.
 *  3. Al cerrar sesión se borra (incluida la key vieja sin scope).
 */

/** Key vieja, global al navegador. Sólo se lee para migrar y se borra. */
export const LEGACY_ACTIVE_TENANT_KEY = 'parkit.activeTenantId';

export function activeTenantStorageKey(userId: string): string {
  return `${LEGACY_ACTIVE_TENANT_KEY}:${userId}`;
}

/**
 * Id activo a usar, dado el candidato guardado y los ids que la persona
 * realmente tiene.
 *
 *  - Sin lista cargada → `''`: todavía no hay nada que se pueda usar, y
 *    devolver el candidato sin validar es justo el bug.
 *  - Candidato que pertenece a la lista → el candidato.
 *  - Cualquier otro (vacío, de otra cuenta, borrado) → el primero.
 */
export function resolveActiveTenantId(
  candidate: string | null | undefined,
  tenantIds: readonly string[],
): string {
  if (tenantIds.length === 0) return '';
  if (candidate && tenantIds.includes(candidate)) return candidate;
  return tenantIds[0];
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Candidato guardado para `userId`: el scopeado o, si no hay, el de la key
 * vieja (migración). NO está validado: pasarlo por `resolveActiveTenantId`.
 */
export function readStoredActiveTenant(userId: string): string | null {
  const store = storage();
  if (!store) return null;
  try {
    return (
      store.getItem(activeTenantStorageKey(userId)) ??
      store.getItem(LEGACY_ACTIVE_TENANT_KEY)
    );
  } catch {
    return null;
  }
}

/** Guarda el id ya validado bajo la key del usuario y descarta la vieja. */
export function writeStoredActiveTenant(userId: string, tenantId: string) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(activeTenantStorageKey(userId), tenantId);
    store.removeItem(LEGACY_ACTIVE_TENANT_KEY);
  } catch {
    // Storage lleno o bloqueado: el panel funciona igual, sólo no recuerda.
  }
}

/** Borra el id activo del usuario (y la key vieja). Para el cierre de sesión. */
export function clearStoredActiveTenant(userId?: string | null) {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(LEGACY_ACTIVE_TENANT_KEY);
    if (userId) store.removeItem(activeTenantStorageKey(userId));
  } catch {
    // Nada que limpiar si el storage no está disponible.
  }
}
