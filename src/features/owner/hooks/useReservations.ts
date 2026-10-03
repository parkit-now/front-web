import { useEffect, useMemo, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  acceptReservation,
  cancelReservation,
  getReservation,
  listAllReservations,
  listReservations,
  rejectReservation,
  retryReservationRefund,
  RESERVATIONS_PAGE_SIZE,
  type OwnerReservation,
  type OwnerReservationDetail,
} from '../services/reservations';
import {
  HISTORY_STATUSES,
  LIVE_STATUSES,
} from '../sections/reservas/reservationUtils';
import {
  arDayKey,
  shiftDayKey,
  toArOffsetIso,
} from '../../../shared/utils/ar-datetime';

/**
 * Polling de la pantalla Reservas: cada 15 segundos y al volver el foco a la
 * pestaña. Todavía no hay realtime (ver el handoff de la fase 5).
 */
export const RESERVATIONS_POLL_MS = 15_000;

const POLLING = {
  staleTime: 0,
  refetchInterval: RESERVATIONS_POLL_MS,
  refetchOnWindowFocus: true,
} as const;

/** Prefijo común: invalidarlo refresca la lista, el contador y los detalles. */
export const reservationsKey = (tenantId: string) =>
  ['reservations', tenantId] as const;

/**
 * Las reservas vivas (por aceptar, próximas, en curso), completas, y el
 * historial reciente. El listado del backend filtra por UN estado, así que se
 * piden por separado y se juntan acá.
 *
 * Historial: solo la primera página (las 100 más recientes por ingreso) de cada
 * estado. Si el dueño tiene más, hace falta un filtro multi-estado y paginado
 * en el backend (queda anotado en el informe de la fase).
 */
export function useReservationsBoard(tenantId: string) {
  const live = useQuery({
    queryKey: [...reservationsKey(tenantId), 'live'],
    queryFn: async () => {
      const groups = await Promise.all(
        LIVE_STATUSES.map((status) =>
          listAllReservations(tenantId, { status }),
        ),
      );
      return groups.flat();
    },
    enabled: Boolean(tenantId),
    ...POLLING,
  });

  const history = useQuery({
    queryKey: [...reservationsKey(tenantId), 'history'],
    queryFn: async () => {
      const pages = await Promise.all(
        HISTORY_STATUSES.map((status) =>
          listReservations(tenantId, {
            status,
            page: 1,
            pageSize: RESERVATIONS_PAGE_SIZE,
          }),
        ),
      );
      return pages
        .flatMap((p) => p.items)
        .sort((a, b) => b.entryAt.localeCompare(a.entryAt));
    },
    enabled: Boolean(tenantId),
    ...POLLING,
  });

  const reservations = useMemo<OwnerReservation[]>(
    () => [...(live.data ?? []), ...(history.data ?? [])],
    [live.data, history.data],
  );

  return {
    reservations,
    // `isPending` y no `isLoading`: mientras no hay estacionamiento activo las
    // consultas están deshabilitadas e `isLoading` da false con datos vacíos, y la
    // pantalla decidiría la pestaña inicial sin saber nada.
    isLoading: live.isPending || history.isPending,
    isError: live.isError || history.isError,
    error: live.error ?? history.error,
    isFetching: live.isFetching || history.isFetching,
    refetch: () => Promise.all([live.refetch(), history.refetch()]),
  };
}

/**
 * Cuántas reservas esperan la respuesta del dueño: el badge del menú. Una sola
 * consulta barata (`pageSize = 1`, solo importa el `total`).
 */
export function usePendingApprovalCount(tenantId: string) {
  const query = useQuery({
    queryKey: [...reservationsKey(tenantId), 'pending-count'],
    queryFn: async () =>
      (
        await listReservations(tenantId, {
          status: 'pending_approval',
          page: 1,
          pageSize: 1,
        })
      ).total,
    enabled: Boolean(tenantId),
    ...POLLING,
  });
  return query.data ?? 0;
}

/**
 * Reservas con ingreso hoy (día de Argentina) que cuentan para el KPI "Hoy":
 * las que se pagaron y no se cayeron. Se piden por rango de `entryAt`.
 */
export function useTodayReservations(tenantId: string) {
  const day = arDayKey();
  return useQuery({
    queryKey: [...reservationsKey(tenantId), 'today', day],
    queryFn: async () => {
      const items = await listAllReservations(tenantId, {
        from: toArOffsetIso(day, '00:00'),
        to: toArOffsetIso(shiftDayKey(day, 1), '00:00'),
      });
      return items.filter((r) =>
        ['confirmed', 'checked_in', 'completed', 'pending_approval'].includes(
          r.status,
        ),
      );
    },
    enabled: Boolean(tenantId),
    ...POLLING,
  });
}

export function useReservationDetail(
  tenantId: string,
  reservationId: string | null,
) {
  return useQuery<OwnerReservationDetail>({
    queryKey: [...reservationsKey(tenantId), 'detail', reservationId],
    queryFn: () => getReservation(tenantId, reservationId as string),
    enabled: Boolean(tenantId && reservationId),
    ...POLLING,
  });
}

function refresh(queryClient: QueryClient, tenantId: string) {
  return queryClient.invalidateQueries({ queryKey: reservationsKey(tenantId) });
}

/** Aceptar, rechazar, cancelar y reintentar el reembolso. */
export function useReservationActions(tenantId: string) {
  const queryClient = useQueryClient();
  const options = {
    onSettled: () => refresh(queryClient, tenantId),
  };
  return {
    accept: useMutation({
      mutationFn: (id: string) => acceptReservation(tenantId, id),
      ...options,
    }),
    reject: useMutation({
      mutationFn: (v: { id: string; reason: string }) =>
        rejectReservation(tenantId, v.id, v.reason),
      ...options,
    }),
    cancel: useMutation({
      mutationFn: (v: { id: string; reason: string }) =>
        cancelReservation(tenantId, v.id, v.reason),
      ...options,
    }),
    retryRefund: useMutation({
      mutationFn: (id: string) => retryReservationRefund(tenantId, id),
      ...options,
    }),
  };
}

/** Reloj que avanza solo mientras haya algo con cuenta regresiva en pantalla. */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
