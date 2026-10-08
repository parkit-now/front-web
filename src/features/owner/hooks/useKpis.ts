import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRevenueSeries } from '../services/metrics';
import { useSucursal } from '../context/SucursalContext';
import { useMetricsSummary } from './useMetrics';
import { arDayKey, toArOffsetIso } from '../../../shared/utils/ar-datetime';

/**
 * View-model de las cards de métricas actuales. Compone `/metrics/summary`
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
    revenue: number | null;
    sparkline: number[];
  };
  updatedAt: string;
  projections: {
    todayWithOpenEntries: ProjectionKpi;
    todayHistoricalForecast: ProjectionKpi;
    monthWithOpenEntries: ProjectionKpi;
    monthHistoricalForecast: ProjectionKpi;
  };
  pendingLprEvents: number;
}

export interface ProjectionKpi {
  value: number;
  openEntries: number;
  historicalDays: number;
  confidence: 'low' | 'medium' | 'high';
}

/** El corte mensual coincide exactamente con el snapshot del resumen. */
function useMonthToDateRevenue(generatedAt?: string) {
  const { sucursalId } = useSucursal();
  const range = useMemo(
    () =>
      generatedAt
        ? {
            from: toArOffsetIso(
              `${arDayKey(new Date(generatedAt)).slice(0, 7)}-01`,
            ),
            to: generatedAt,
            granularity: 'day' as const,
          }
        : null,
    [generatedAt],
  );

  return useQuery({
    queryKey: ['metrics', sucursalId, 'revenue', 'month-to-date', range],
    queryFn: () => getRevenueSeries({ tenantId: sucursalId, ...range! }),
    enabled: Boolean(sucursalId && range),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
}

export function useKpis() {
  const summaryQuery = useMetricsSummary(true);
  const monthQuery = useMonthToDateRevenue(summaryQuery.data?.generatedAt);

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
      updatedAt: summary.generatedAt,
      month: {
        revenue: monthQuery.data?.totals.revenue ?? null,
        sparkline: buckets.map((bucket) => bucket.revenue),
      },
      projections: {
        todayWithOpenEntries: summary.projections.todayWithOpenEntries,
        todayHistoricalForecast: summary.projections.todayHistoricalForecast,
        monthWithOpenEntries: summary.projections.monthWithOpenEntries,
        monthHistoricalForecast: summary.projections.monthHistoricalForecast,
      },
      pendingLprEvents: summary.alerts.pendingLprEvents,
    };
  }, [summaryQuery.data, monthQuery.data]);

  return {
    data,
    isLoading: summaryQuery.isLoading,
    isMonthLoading: monthQuery.isLoading,
    isMonthError: monthQuery.isError,
    isError: summaryQuery.isError,
    error: summaryQuery.error,
  };
}
