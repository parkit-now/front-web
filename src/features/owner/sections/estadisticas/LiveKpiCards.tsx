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
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 10,
        marginBottom: 16,
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
