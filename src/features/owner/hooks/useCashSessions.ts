import { useQuery } from '@tanstack/react-query';
import { listCashSessions } from '../services/cash-sessions';
import { useSucursal } from '../context/SucursalContext';

/** Cuántos turnos se ofrecen en el `<select>` del filtro por caja. */
const CASH_SESSION_LIMIT = 60;

/**
 * Turnos de caja de la sucursal activa, para el filtro por caja de estadísticas
 * de ingresos.
 *
 * Va detrás de un `enabled` para no pedir la lista en cada visita a la página,
 * solo cuando el usuario elige filtrar por caja.
 */
export function useCashSessions(enabled: boolean) {
  const { sucursalId } = useSucursal();
  return useQuery({
    queryKey: ['cash-sessions', sucursalId, { limit: CASH_SESSION_LIMIT }],
    queryFn: () => listCashSessions(sucursalId, { limit: CASH_SESSION_LIMIT }),
    enabled: Boolean(sucursalId) && enabled,
    staleTime: 60_000,
  });
}
