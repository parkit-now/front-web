import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useToast } from '../../../lib/notifications/ToastProvider';
import {
  addStaff,
  countOwners,
  listStaff,
  removeStaff,
  updateStaffRole,
  type AddStaffInput,
  type StaffMembershipRole,
  type StaffRole,
} from '../services/staff';

/** Prefijo común del listado y de los conteos: invalidarlo refresca todo. */
const STAFF_KEY = ['staff'] as const;

export interface StaffFilters {
  search?: string;
  role?: StaffRole;

  tenantId?: string;
  page: number;
  pageSize: number;
}

/**
 * `/me/staff` es cross-tenant: el alcance sale de las membresías del que
 * consulta, no de la sucursal activa. Por eso el hook no usa `useSucursal()`
 * — la página decide si acota con `tenantId` o no.
 */
export function useStaffList(filters: StaffFilters) {
  return useQuery({
    queryKey: [...STAFF_KEY, 'list', filters],
    queryFn: () => listStaff(filters),
    placeholderData: keepPreviousData,
  });
}

/**
 * Cuántos dueños tiene cada sucursal, para la regla "siempre queda al menos
 * uno". `undefined` mientras carga: el caller deshabilita el control hasta
 * saberlo, en vez de habilitarlo y quitárselo al usuario medio segundo después.
 *
 * Se llama con las sucursales de UNA persona (las de la fila que se está
 * gestionando), no con todas las del dueño: son un puñado de queries de
 * `pageSize: 1`, no una por playa del padrón.
 */
export function useOwnerCounts(
  tenantIds: string[],
): Record<string, number | undefined> {
  const unique = Array.from(new Set(tenantIds));

  const results = useQueries({
    queries: unique.map((tenantId) => ({
      queryKey: [...STAFF_KEY, 'owner-count', tenantId],
      queryFn: () => countOwners(tenantId),
      staleTime: 30_000,
    })),
  });

  const counts: Record<string, number | undefined> = {};
  unique.forEach((tenantId, index) => {
    counts[tenantId] = results[index]?.data;
  });
  return counts;
}

/**
 * Las tres mutaciones del ABM de personal.
 *
 * Cada una invalida el prefijo `['staff']` —listado y conteos— en vez de
 * parchear el estado local: sacar a alguien de su única sucursal lo saca del
 * listado entero, y el conteo de dueños cambia con casi cualquier operación.
 *
 * **El `onError` lo pone el caller**, en el `.mutate(vars, { onError })`. No se
 * define acá a propósito: el alta tiene que pintar el 404 y el 409 abajo del
 * input de email (y dejar el modal abierto), no tostarlos.
 */
export function useStaffMutations() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: STAFF_KEY });
  }

  const addMutation = useMutation({
    mutationFn: (vars: { tenantId: string; body: AddStaffInput }) =>
      addStaff(vars.tenantId, vars.body),
    onSuccess: (result) => {
      invalidate();
      showToast({
        message: `${result.name ?? result.email} ahora trabaja en ${result.tenantName}.`,
        kind: 'success',
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: (vars: {
      tenantId: string;
      userId: string;
      role: StaffMembershipRole;
    }) => updateStaffRole(vars.tenantId, vars.userId, vars.role),
    onSuccess: (result) => {
      invalidate();
      showToast({
        message: `Rol actualizado en ${result.tenantName}.`,
        kind: 'success',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (vars: {
      tenantId: string;
      userId: string;
      tenantName: string;
    }) => removeStaff(vars.tenantId, vars.userId),
    onSuccess: (_result, vars) => {
      invalidate();
      showToast({
        message: `Persona desvinculada de ${vars.tenantName}.`,
        kind: 'success',
      });
    },
  });

  return { addMutation, updateRoleMutation, removeMutation };
}
