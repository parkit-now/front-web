import { fmtMoney0 } from '../../../../shared/utils/fmt';
import { Sparkline } from '../../../../shared/components/Sparkline';
import { ProgressBar } from '../../../../shared/components/ProgressBar';
import { Skeleton } from '../../../../shared/components/ui/Skeleton';
import type { OwnerKpis } from '../../hooks/useKpis';

interface KpiCardsProps {
  kpis: OwnerKpis | undefined;
  loading: boolean;
  monthLoading?: boolean;
}

function KpiOcupacion({ kpis, loading }: KpiCardsProps) {
  const pct = kpis?.occupancy.pct;
  // `null` significa que el lote no configuró capacidad: no es 0%.
  const unknownCapacity = !loading && kpis != null && pct === null;
  const pctValue =
    pct === null || pct === undefined ? 0 : Math.round(pct * 100);
  const color = pctValue > 85 ? 'var(--err-text)' : 'var(--brand)';

  return (
    <div className="pk-card pk-card-pad">
      <p className="pk-label" style={{ marginBottom: 12 }}>
        Ocupación actual
      </p>
      {loading ? (
        <>
          <Skeleton height={36} width="60%" />
          <div style={{ marginTop: 12 }}>
            <Skeleton height={6} />
          </div>
        </>
      ) : unknownCapacity ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-3)',
              }}
            >
              Sin configurar
            </span>
          </div>
          <p
            style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)' }}
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
                fontSize: 36,
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
          <div style={{ marginTop: 12 }}>
            <ProgressBar value={pctValue} max={100} color={color} />
          </div>
          <p
            style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)' }}
          >
            {kpis?.occupancy.free ?? 0} plazas libres
          </p>
        </>
      )}
    </div>
  );
}

function KpiIngresosDia({ kpis, loading }: KpiCardsProps) {
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
    <div className="pk-card pk-card-pad">
      <p className="pk-label" style={{ marginBottom: 12 }}>
        Ingresos del día
      </p>
      {loading ? (
        <>
          <Skeleton height={36} width="70%" />
          <div style={{ marginTop: 8 }}>
            <Skeleton height={16} width="40%" />
          </div>
        </>
      ) : (
        <>
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text-1)',
              fontFamily: 'var(--mono)',
            }}
          >
            {fmtMoney0(kpis?.today.revenue ?? 0)}
          </span>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: deltaColor }}>
            {noBaseline
              ? 'Sin datos de ayer para comparar'
              : `${delta > 0 ? '+' : ''}${Math.round(delta * 100)}% vs. ayer`}
          </p>
        </>
      )}
    </div>
  );
}

function KpiIngresosMes({ kpis, loading, monthLoading }: KpiCardsProps) {
  return (
    <div className="pk-card pk-card-pad">
      <p className="pk-label" style={{ marginBottom: 12 }}>
        Ingresos del mes
      </p>
      {loading || monthLoading ? (
        <>
          <Skeleton height={36} width="70%" />
          <div style={{ marginTop: 8 }}>
            <Skeleton height={32} width={80} />
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
                fontSize: 28,
                fontWeight: 700,
                color: 'var(--text-1)',
                fontFamily: 'var(--mono)',
              }}
            >
              {fmtMoney0(kpis?.month.revenue ?? 0)}
            </span>
            <Sparkline
              data={kpis?.month.sparkline ?? []}
              width={80}
              height={32}
            />
          </div>
          <p
            style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-3)' }}
          >
            Acumulado del mes en curso
          </p>
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
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <KpiOcupacion kpis={kpis} loading={loading} />
      <KpiIngresosDia kpis={kpis} loading={loading} />
      <KpiIngresosMes
        kpis={kpis}
        loading={loading}
        monthLoading={monthLoading}
      />
    </div>
  );
}
