import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { KpiCards } from './KpiCards';
import { LiveMonitor } from './LiveMonitor';
import { useKpis } from '../../hooks/useKpis';
import { useBays } from '../../hooks/useBays';
import { useSucursal } from '../../context/SucursalContext';

export function DashboardPage() {
  const { sucursal } = useSucursal();
  const { data: kpis, isLoading: kpisLoading } = useKpis();
  const { data: bays = [], isLoading: baysLoading } = useBays();

  return (
    <div>
      <SectionHeader
        title="Monitoreo en vivo"
        subtitle={
          sucursal ? `${sucursal.nombre} · ${sucursal.direccion}` : undefined
        }
      />
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
