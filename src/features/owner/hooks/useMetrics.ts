import { useQuery } from '@tanstack/react-query';
import {
  getMetricsSummary,
  getRevenueByPaymentMethod,
  getRevenueSeries,
  getTopPlates,
  type Granularity,
  type TopPlatesOrderBy,
  type VehicleTypeFilter,
} from '../services/metrics';
import { useSucursal } from '../context/SucursalContext';

const METRICS_KEY = ['metrics'] as const;

/** Filtros que comparten los tres paneles del dashboard de ingresos. */
export interface RevenueFilters {
  from: string;
  to: string;
  granularity: Granularity;
  paymentMethod?: string;
  vehicleType?: VehicleTypeFilter;
}

/**
 * Serie temporal del gráfico. Trae `revenue` y `vehiclesIn` en el mismo
 * payload, así que el switch $/autos de la UI no dispara otra request.
 */
export function useRevenueSeries(filters: RevenueFilters) {
  const { sucursalId } = useSucursal();
  return useQuery({
    queryKey: [...METRICS_KEY, sucursalId, 'revenue', filters],
    queryFn: () => getRevenueSeries({ tenantId: sucursalId, ...filters }),
    enabled: Boolean(sucursalId && filters.from && filters.to),
  });
}

/**
 * Torta por método de pago. No acepta `paymentMethod` (es el desglose
 * completo), pero sí `vehicleType`.
 */
export function useRevenueByPaymentMethod(filters: RevenueFilters) {
  const { sucursalId } = useSucursal();
  const { from, to, vehicleType } = filters;
  return useQuery({
    queryKey: [
      ...METRICS_KEY,
      sucursalId,
      'by-payment-method',
      { from, to, vehicleType },
    ],
    queryFn: () =>
      getRevenueByPaymentMethod({
        tenantId: sucursalId,
        from,
        to,
        vehicleType,
      }),
    enabled: Boolean(sucursalId && from && to),
  });
}

/**
 * Top de patentes. Se pide una sola vez por ventana: las tres métricas vienen
 * siempre, así que reordenar es un sort en cliente (ver `sortTopPlates`).
 */
export function useTopPlates(
  filters: RevenueFilters,
  options?: { limit?: number },
) {
  const { sucursalId } = useSucursal();
  const { from, to, vehicleType } = filters;
  const limit = options?.limit ?? 10;
  return useQuery({
    queryKey: [
      ...METRICS_KEY,
      sucursalId,
      'top-plates',
      { from, to, vehicleType, limit },
    ],
    queryFn: () =>
      getTopPlates({ tenantId: sucursalId, from, to, vehicleType, limit }),
    enabled: Boolean(sucursalId && from && to),
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

export type { Granularity, TopPlatesOrderBy, VehicleTypeFilter };
