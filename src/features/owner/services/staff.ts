import type { components, operations } from '../../../generated/api-types';
import { ApiError, apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';

export type StaffMember = components['schemas']['StaffMemberDto'];
export type StaffMembership = components['schemas']['StaffMembershipDto'];
export type PaginatedStaff = components['schemas']['PaginatedStaffDto'];
/** Valor del filtro `role` del listado: opcional, o sea que incluye `undefined`. */
export type StaffRole = NonNullable<
  operations['staffList']['parameters']['query']
>['role'];

/**
 * El rol de una membresía concreta. No es `StaffRole`: ése sale de un query
 * param opcional y arrastra el `undefined`, que no tiene sentido cuando el rol
 * siempre está (una membresía sin rol no existe).
 */
export type StaffMembershipRole = StaffMembership['role'];

/** Una membresía recién creada o modificada: la persona + dónde y con qué rol quedó. */
export type StaffMembershipResult =
  components['schemas']['StaffMembershipResultDto'];
export type AddStaffInput = components['schemas']['CreateStaffMemberDto'];
type UpdateStaffBody = components['schemas']['UpdateStaffMemberDto'];

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * Personal de las sucursales donde el que consulta es `owner`.
 *
 * **No lleva `:tenantId` en el path**: el alcance sale de las membresías del
 * llamador, no de la URL. Por eso:
 *
 * - Devuelve **una fila por persona** con todas sus membresías; quien trabaja
 *   en dos sucursales aparece una vez con dos roles.
 * - `role` filtra **quién aparece**, no qué se muestra: alguien que es
 *   `operator` en una sucursal y `owner` en otra sale bajo cualquiera de los
 *   dos filtros, con ambos roles visibles.
 * - Un `operator` (o un admin sin membresías) recibe `{ items: [], total: 0 }`,
 *   no un 403.
 *
 * `tenantId` acota a una sucursal propia; una ajena responde 403.
 */
export async function listStaff(input: {
  search?: string;
  role?: StaffRole;
  tenantId?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedStaff> {
  const params = new URLSearchParams();
  if (input.search) params.set('search', input.search);
  if (input.role) params.set('role', input.role);
  if (input.tenantId) params.set('tenantId', input.tenantId);
  if (input.page !== undefined) params.set('page', String(input.page));
  if (input.pageSize !== undefined)
    params.set('pageSize', String(input.pageSize));

  const qs = params.toString();
  return apiRequest<PaginatedStaff>({
    method: 'GET',
    path: `/me/staff${qs ? `?${qs}` : ''}`,
    bearer: await bearer(),
  });
}

/**
 * Cuántas personas son `owner` de esa sucursal.
 *
 * Acotado a un `tenantId` el filtro `role` es por membresía, no por persona: el
 * backend combina los dos dentro del mismo `some`. O sea que el `total` es el
 * conteo exacto de dueños de esa playa, y con `pageSize: 1` no trae filas.
 *
 * Es lo que necesita la regla "siempre queda al menos un dueño" para
 * deshabilitar el control antes de que el usuario choque contra el 409.
 */
export async function countOwners(tenantId: string): Promise<number> {
  const { total } = await listStaff({
    tenantId,
    role: 'owner',
    page: 1,
    pageSize: 1,
  });
  return total;
}

/**
 * POST /tenants/:tenantId/staff — suma a alguien al plantel de esa sucursal.
 *
 * Es también la forma de darle un rol en una sucursal **adicional** sin sacarle
 * el que ya tiene: mismo email, otro `tenantId`.
 *
 * La persona se identifica por email y tiene que tener cuenta: **no hay
 * invitación**, un mail sin cuenta responde `404 USER_NOT_FOUND` y no se manda
 * ningún correo. Guardar el `userId` de la respuesta: los PATCH/DELETE van por
 * id, no por email (que además puede cambiar en Supabase después del alta).
 */
export async function addStaff(
  tenantId: string,
  body: AddStaffInput,
): Promise<StaffMembershipResult> {
  return apiRequest<StaffMembershipResult>({
    method: 'POST',
    path: `/tenants/${tenantId}/staff`,
    body,
    bearer: await bearer(),
  });
}

/**
 * PATCH /tenants/:tenantId/staff/:userId — cambia el rol en esa sucursal.
 *
 * La firma toma el rol suelto y no un body a propósito: el endpoint también
 * acepta `tenantId`, y mandarlo **muda** la membresía (la sucursal de la URL
 * pierde a la persona). Acá no hacemos mudanzas — mover a alguien es
 * `addStaff` en la nueva + `removeStaff` en la vieja, dos acciones explícitas—
 * así que no hay forma de mandarlo por accidente.
 *
 * Es idempotente: mandar el rol que la persona ya tiene devuelve 200 sin
 * escribir.
 */
export async function updateStaffRole(
  tenantId: string,
  userId: string,
  role: StaffMembershipRole,
): Promise<StaffMembershipResult> {
  const body: UpdateStaffBody = { role };
  return apiRequest<StaffMembershipResult>({
    method: 'PATCH',
    path: `/tenants/${tenantId}/staff/${userId}`,
    body,
    bearer: await bearer(),
  });
}

/**
 * DELETE /tenants/:tenantId/staff/:userId — desvincula a la persona de **esa**
 * sucursal. Su cuenta y sus otras sucursales quedan intactas.
 *
 * El endpoint no es idempotente: un segundo DELETE da `404
 * MEMBERSHIP_NOT_FOUND`. Se absorbe acá porque el estado final es el que el
 * usuario pidió — no tiene por qué ver un error rojo por haber hecho doble
 * click o por tener otra pestaña abierta.
 */
export async function removeStaff(
  tenantId: string,
  userId: string,
): Promise<void> {
  try {
    await apiRequest<void>({
      method: 'DELETE',
      path: `/tenants/${tenantId}/staff/${userId}`,
      bearer: await bearer(),
    });
  } catch (error) {
    const alreadyGone =
      error instanceof ApiError &&
      error.status === 404 &&
      (error.problem as { code?: string } | null)?.code ===
        'MEMBERSHIP_NOT_FOUND';
    if (!alreadyGone) throw error;
  }
}
