import { fmtMoney0 } from '../../../../shared/utils/fmt';
import { Sparkline } from '../../../../shared/components/Sparkline';
import { ProgressBar } from '../../../../shared/components/ProgressBar';
import { Skeleton } from '../../../../shared/components/ui/Skeleton';
import type { OwnerKpis } from '../../hooks/useKpis';
import {
  historicalProjectionSubtitle,
  openEntriesProjectionSubtitle,
} from './projectionCopy';

interface KpiCardsProps {
  kpis: OwnerKpis | undefined;
  loading: boolean;
  monthLoading?: boolean;
}

function ProjectionPill({
  label,
  value,
  subtitle,
  tone = 'default',
}: {
  label: string;
  value: number;
  subtitle: string;
  tone?: 'default' | 'brand';
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: '10px 11px',
        border: '1px solid var(--border)',
        borderRadius: 14,
        background:
          tone === 'brand'
            ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(37, 99, 235, 0.03))'
            : 'var(--surface)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-3)',
          textTransform: 'uppercase',
          letterSpacing: '.03em',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: '5px 0 0',
          fontFamily: 'var(--mono)',
          fontSize: 18,
          fontWeight: 800,
          color: tone === 'brand' ? 'var(--brand)' : 'var(--text-1)',
          overflowWrap: 'anywhere',
        }}
      >
        {fmtMoney0(value)}
      </p>
      <p
        style={{
          margin: '4px 0 0',
          fontSize: 11,
          lineHeight: 1.35,
          color: 'var(--text-3)',
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function ProjectionGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 8,
        marginTop: 12,
      }}
    >
      {children}
    </div>
  );
}

function OccupancyMiniMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: '9px 10px',
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--surface)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-3)',
          textTransform: 'uppercase',
          letterSpacing: '.03em',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: '4px 0 0',
          fontFamily: 'var(--mono)',
          fontSize: 18,
          fontWeight: 800,
          color: 'var(--text-1)',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function KpiOcupacion({ kpis, loading }: KpiCardsProps) {
  const pct = kpis?.occupancy.pct;
  // `null` significa que el lote no configuró capacidad: no es 0%.
  const unknownCapacity = !loading && kpis != null && pct === null;
  const pctValue =
    pct === null || pct === undefined ? 0 : Math.round(pct * 100);
  const color = pctValue > 85 ? 'var(--err-text)' : 'var(--brand)';

  return (
    <div className="pk-card" style={{ padding: '14px 16px' }}>
      <p className="pk-label" style={{ marginBottom: 6 }}>
        Ocupación actual
      </p>
      {loading ? (
        <>
          <Skeleton height={28} width="52%" />
          <div style={{ marginTop: 8 }}>
            <Skeleton height={5} />
          </div>
        </>
      ) : unknownCapacity ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text-3)',
              }}
            >
              Sin configurar
            </span>
          </div>
          <p
            style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-3)' }}
          >
            {kpis?.occupancy.occupied ?? 0} vehículos adentro · falta definir la
            capacidad del estacionamiento
          </p>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color,
                fontFamily: 'var(--mono)',
              }}
            >
              {pctValue}%
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
              {kpis?.occupancy.occupied ?? 0}/{kpis?.occupancy.capacity ?? 0}
            </span>
          </div>
          <div style={{ marginTop: 6 }}>
            <ProgressBar value={pctValue} max={100} color={color} />
          </div>
          <p
            style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-3)' }}
          >
            {kpis?.occupancy.free ?? 0} plazas libres
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
              marginTop: 12,
            }}
          >
            <OccupancyMiniMetric
              label="Ingresos hoy"
              value={kpis?.today.vehiclesIn ?? 0}
            />
            <OccupancyMiniMetric
              label="Egresos hoy"
              value={kpis?.today.vehiclesOut ?? 0}
            />
          </div>
        </>
      )}
    </div>
  );
}

function KpiRecaudacionDia({ kpis, loading }: KpiCardsProps) {
  const delta = kpis?.revenueDeltaPct;
  // `null` cuando ayer no recaudó nada: un porcentaje sobre base 0 no existe.
  const noBaseline = delta === null || delta === undefined;
  const deltaColor =
    noBaseline || delta === 0
      ? 'var(--text-3)'
      : delta > 0
        ? 'var(--ok-text)'
        : 'var(--err-text)';

  return (
    <div className="pk-card" style={{ padding: '14px 16px' }}>
      <p className="pk-label" style={{ marginBottom: 6 }}>
        Recaudación del día
      </p>
      {loading ? (
        <>
          <Skeleton height={28} width="62%" />
          <div style={{ marginTop: 6 }}>
            <Skeleton height={14} width="46%" />
          </div>
        </>
      ) : (
        <>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text-1)',
              fontFamily: 'var(--mono)',
            }}
          >
            {fmtMoney0(kpis?.today.revenue ?? 0)}
          </span>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: deltaColor }}>
            {noBaseline
              ? 'Sin datos de ayer para comparar'
              : `${delta > 0 ? '+' : ''}${Math.round(delta * 100)}% vs. ayer`}
          </p>
          <ProjectionGrid>
            <ProjectionPill
              label="Proyección con autos en base"
              value={kpis?.projections.todayWithOpenEntries.value ?? 0}
              subtitle={openEntriesProjectionSubtitle(
                kpis?.projections.todayWithOpenEntries ?? {
                  value: 0,
                  openEntries: 0,
                  historicalDays: 0,
                  confidence: 'low',
                },
              )}
              tone="brand"
            />
            <ProjectionPill
              label="Proyección por tendencia"
              value={kpis?.projections.todayHistoricalForecast.value ?? 0}
              subtitle={historicalProjectionSubtitle(
                kpis?.projections.todayHistoricalForecast ?? {
                  value: 0,
                  openEntries: 0,
                  historicalDays: 0,
                  confidence: 'low',
                },
              )}
            />
          </ProjectionGrid>
        </>
      )}
    </div>
  );
}

function KpiRecaudacionMes({ kpis, loading, monthLoading }: KpiCardsProps) {
  return (
    <div className="pk-card" style={{ padding: '14px 16px' }}>
      <p className="pk-label" style={{ marginBottom: 6 }}>
        Recaudación del mes
      </p>
      {loading || monthLoading ? (
        <>
          <Skeleton height={28} width="62%" />
          <div style={{ marginTop: 6 }}>
            <Skeleton height={24} width={64} />
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text-1)',
                fontFamily: 'var(--mono)',
              }}
            >
              {fmtMoney0(kpis?.month.revenue ?? 0)}
            </span>
            <Sparkline
              data={kpis?.month.sparkline ?? []}
              width={64}
              height={24}
            />
          </div>
          <p
            style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-3)' }}
          >
            Acumulado del mes en curso
          </p>
          <ProjectionGrid>
            <ProjectionPill
              label="Proyección con autos en base"
              value={kpis?.projections.monthWithOpenEntries.value ?? 0}
              subtitle={openEntriesProjectionSubtitle(
                kpis?.projections.monthWithOpenEntries ?? {
                  value: 0,
                  openEntries: 0,
                  historicalDays: 0,
                  confidence: 'low',
                },
              )}
              tone="brand"
            />
            <ProjectionPill
              label="Proyección por tendencia"
              value={kpis?.projections.monthHistoricalForecast.value ?? 0}
              subtitle={historicalProjectionSubtitle(
                kpis?.projections.monthHistoricalForecast ?? {
                  value: 0,
                  openEntries: 0,
                  historicalDays: 0,
                  confidence: 'low',
                },
              )}
            />
          </ProjectionGrid>
        </>
      )}
    </div>
  );
}

export function KpiCards({ kpis, loading, monthLoading }: KpiCardsProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
        gap: 10,
        marginBottom: 10,
      }}
    >
      <KpiOcupacion kpis={kpis} loading={loading} />
      <KpiRecaudacionDia kpis={kpis} loading={loading} />
      <KpiRecaudacionMes
        kpis={kpis}
        loading={loading}
        monthLoading={monthLoading}
      />
    </div>
  );
}
