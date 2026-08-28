import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { Badge } from '../../../../shared/components/ui/Badge';
import { IconCar, IconChevronRight } from '../../../../shared/components/icons';
import { KpiCards } from './KpiCards';
import { LiveMonitor } from './LiveMonitor';
import { useKpis } from '../../hooks/useKpis';
import { useBays } from '../../hooks/useBays';
import { useSucursal } from '../../context/SucursalContext';
import { listLprDetectionEvents } from '../../services/lpr-events';

export function DashboardPage() {
  const { mode, sucursal, sucursalId } = useSucursal();
  const { data: kpis, isLoading: kpisLoading } = useKpis();
  const { data: bays = [], isLoading: baysLoading } = useBays();
  const dismissedQuery = useQuery({
    queryKey: ['lpr-events', sucursalId, 'dismissed-count'],
    queryFn: () =>
      listLprDetectionEvents({
        tenantId: sucursalId,
        status: 'dismissed',
        page: 1,
        pageSize: 1,
      }),
    enabled: Boolean(sucursalId),
    staleTime: 30_000,
  });

  const dismissedCount = dismissedQuery.data?.total ?? 0;
  const reviewPath =
    mode === 'admin'
      ? `/ops/estacionamientos/${sucursalId}/revision-lpr`
      : '/app/revision-lpr';

  return (
    <div>
      <SectionHeader
        title="Monitoreo en vivo"
        subtitle={
          sucursal
            ? [sucursal.nombre, sucursal.direccion].filter(Boolean).join(' · ')
            : undefined
        }
      />
      {dismissedCount > 0 && (
        <Link to={reviewPath} className="dashboard-lpr-review-link">
          <div className="dashboard-lpr-review-icon">
            <IconCar size={18} />
          </div>
          <div className="dashboard-lpr-review-copy">
            <strong>Patentes descartadas</strong>
            <span>
              {dismissedCount}{' '}
              {dismissedCount === 1
                ? 'descarte del operario'
                : 'descartes del operario'}
            </span>
          </div>
          <Badge variant="warn">{dismissedCount}</Badge>
          <IconChevronRight size={16} />
        </Link>
      )}
      <KpiCards kpis={kpis} loading={kpisLoading} />
      {baysLoading ? (
        <div className="pk-card pk-card-pad" style={{ minHeight: 200 }}>
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
            Cargando monitor...
          </p>
        </div>
      ) : (
        <LiveMonitor bays={bays} />
      )}
    </div>
  );
}
