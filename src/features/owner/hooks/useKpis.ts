import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRevenueSeries } from '../services/metrics';
import { useSucursal } from '../context/SucursalContext';
import { useMetricsSummary } from './useMetrics';
import {
  arDayKey,
  monthToDateRange,
  toArOffsetIso,
} from '../../../shared/utils/ar-datetime';

/**
 * View-model de las cards del dashboard en vivo. Compone `/metrics/summary`
 * (ocupación + hoy + comparativa) con una ventana month-to-date de
 * `/metrics/revenue`, que es de donde sale el acumulado del mes: `summary` no
 * lo devuelve.
 */
export interface OwnerKpis {
  occupancy: {
    pct: number | null;
    occupied: number;
    capacity: number;
    free: number | null;
  };
  today: {
    revenue: number;
    vehiclesIn: number;
    vehiclesOut: number;
  };
  /** `null` cuando la base es 0: mostrar "sin datos", nunca 0% ni ∞. */
  revenueDeltaPct: number | null;
  month: {
    revenue: number;
    sparkline: number[];
  };
  pendingLprEvents: number;
}

/** Acumulado del mes en curso. La ventana es estable durante todo el día. */
function useMonthToDateRevenue() {
  const { sucursalId } = useSucursal();
  const today = arDayKey();
  const range = useMemo(
    () => monthToDateRange(new Date(toArOffsetIso(today, '12:00'))),
    [today],
  );

  return useQuery({
    queryKey: ['metrics', sucursalId, 'revenue', 'month-to-date', range],
    queryFn: () => getRevenueSeries({ tenantId: sucursalId, ...range }),
    enabled: Boolean(sucursalId),
    staleTime: 60_000,
  });
}

export function useKpis() {
  const summaryQuery = useMetricsSummary();
  const monthQuery = useMonthToDateRevenue();

  const data = useMemo<OwnerKpis | undefined>(() => {
    const summary = summaryQuery.data;
    if (!summary) return undefined;

    const buckets = monthQuery.data?.buckets ?? [];

    return {
      occupancy: {
        pct: summary.occupancy.occupancyPct,
        occupied: summary.occupancy.occupied,
        capacity: summary.occupancy.capacity,
        free: summary.occupancy.free,
      },
      today: {
        revenue: summary.today.revenue,
        vehiclesIn: summary.today.vehiclesIn,
        vehiclesOut: summary.today.vehiclesOut,
      },
      revenueDeltaPct: summary.comparison.previousDay.revenueDeltaPct,
      month: {
        revenue: monthQuery.data?.totals.revenue ?? 0,
        sparkline: buckets.map((bucket) => bucket.revenue),
      },
      pendingLprEvents: summary.alerts.pendingLprEvents,
    };
  }, [summaryQuery.data, monthQuery.data]);

  return {
    data,
    isLoading: summaryQuery.isLoading,
    isMonthLoading: monthQuery.isLoading,
    isError: summaryQuery.isError,
    error: summaryQuery.error,
  };
}
