import { skipToken, useQuery } from '@tanstack/react-query';
import { ApiError } from '../../../lib/api/client';
import {
  getMetricsSummary,
  getRevenueByPaymentMethod,
  getRevenueSeries,
  getTopPlates,
  getVehicleCategoryBreakdown,
  type Granularity,
  type MetricsScope,
  type TopPlatesOrderBy,
  type VehicleCategoryFilter,
} from '../services/metrics';
import { useSucursal } from '../context/SucursalContext';

const METRICS_KEY = ['metrics'] as const;

/**
 * Filtros que comparten los tres paneles de estadísticas. `null` en
 * los hooks significa "todavía no hay nada que pedir" (rango incompleto, caja
 * sin elegir): no se dispara ninguna request.
 */
export type RevenueFilters = MetricsScope & {
  granularity: Granularity;
  paymentMethod?: string;
  vehicleCategory?: VehicleCategoryFilter;
};

/** Solo la parte del recorte, para las queries que no usan granularidad. */
function scopeOf(filters: RevenueFilters): MetricsScope {
  return filters.cashSessionId !== undefined
    ? { cashSessionId: filters.cashSessionId }
    : { from: filters.from, to: filters.to };
}

/**
 * La ventana de una caja la calcula el backend y puede quedar más ancha que el
 * turno, así que el tope de buckets no se puede prever del todo en cliente. Si
 * una caja por hora no entra (400), se reintenta por día, como recomienda el
 * backend; la respuesta trae la granularidad que se usó y la UI lo avisa.
 *
 * Cualquier otro 400 se reproduce igual en el reintento y termina en el mismo
 * estado de error, así que no hace falta distinguirlo.
 */
async function fetchRevenueSeries(
  input: Parameters<typeof getRevenueSeries>[0],
) {
  try {
    return await getRevenueSeries(input);
  } catch (error) {
    const bucketLimitOnShift =
      input.cashSessionId !== undefined &&
      input.granularity === 'hour' &&
      error instanceof ApiError &&
      error.status === 400;
    if (!bucketLimitOnShift) throw error;
    return getRevenueSeries({ ...input, granularity: 'day' });
  }
}

/**
 * Serie temporal del gráfico. Trae `revenue` y `vehiclesIn` en el mismo
 * payload, así que las pestañas $/autos de la UI no disparan otra request.
 */
export function useRevenueSeries(filters: RevenueFilters | null) {
  const { sucursalId } = useSucursal();
  return useQuery({
    queryKey: [...METRICS_KEY, sucursalId, 'revenue', filters],
    queryFn:
      sucursalId && filters
        ? () => fetchRevenueSeries({ tenantId: sucursalId, ...filters })
        : skipToken,
  });
}

/**
 * Torta por método de pago. No acepta `paymentMethod` (es el desglose
 * completo), pero sí `vehicleCategory` y la caja.
 */
export function useRevenueByPaymentMethod(filters: RevenueFilters | null) {
  const { sucursalId } = useSucursal();
  const scope = filters && scopeOf(filters);
  const vehicleCategory = filters?.vehicleCategory;
  return useQuery({
    queryKey: [
      ...METRICS_KEY,
      sucursalId,
      'by-payment-method',
      { scope, vehicleCategory },
    ],
    queryFn:
      sucursalId && scope
        ? () =>
            getRevenueByPaymentMethod({
              tenantId: sucursalId,
              ...scope,
              vehicleCategory,
            })
        : skipToken,
  });
}

/**
 * Torta por categoría de vehículo. Es la distribución completa del período, así
 * que ignora el filtro de categoría (con uno solo elegido sería una torta de una
 * porción) pero respeta la ventana o la caja.
 */
export function useVehicleCategoryBreakdown(filters: RevenueFilters | null) {
  const { sucursalId } = useSucursal();
  const scope = filters && scopeOf(filters);
  return useQuery({
    queryKey: [...METRICS_KEY, sucursalId, 'by-vehicle-category', { scope }],
    queryFn:
      sucursalId && scope
        ? () => getVehicleCategoryBreakdown({ tenantId: sucursalId, ...scope })
        : skipToken,
  });
}

/**
 * Top de patentes. Se pide una sola vez por recorte: las tres métricas vienen
 * siempre, así que reordenar es un sort en cliente (ver `sortTopPlates`).
 */
export function useTopPlates(
  filters: RevenueFilters | null,
  options?: { limit?: number },
) {
  const { sucursalId } = useSucursal();
  const scope = filters && scopeOf(filters);
  const vehicleCategory = filters?.vehicleCategory;
  const limit = options?.limit ?? 10;
  return useQuery({
    queryKey: [
      ...METRICS_KEY,
      sucursalId,
      'top-plates',
      { scope, vehicleCategory, limit },
    ],
    queryFn:
      sucursalId && scope
        ? () =>
            getTopPlates({
              tenantId: sucursalId,
              ...scope,
              vehicleCategory,
              limit,
            })
        : skipToken,
  });
}

/** KPIs de cabecera: ocupación viva, totales de hoy y comparativa. */
export function useMetricsSummary() {
  const { sucursalId } = useSucursal();
  return useQuery({
    queryKey: [...METRICS_KEY, sucursalId, 'summary'],
    queryFn: () => getMetricsSummary({ tenantId: sucursalId }),
    enabled: Boolean(sucursalId),
    staleTime: 30_000,
  });
}

export type { Granularity, TopPlatesOrderBy, VehicleCategoryFilter };
