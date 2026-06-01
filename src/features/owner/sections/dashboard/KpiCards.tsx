import { fmtMoney0 } from '../../../../shared/utils/fmt';
import { Sparkline } from '../../../../shared/components/Sparkline';
import { ProgressBar } from '../../../../shared/components/ProgressBar';
import { Skeleton } from '../../../../shared/components/ui/Skeleton';
import type { KpiSnapshot } from '../../../../types/api';

interface KpiCardsProps {
  kpis: KpiSnapshot | undefined;
  loading: boolean;
}

function KpiOcupacion({ kpis, loading }: KpiCardsProps) {
  const color =
    (kpis?.ocupacion_pct ?? 0) > 85 ? 'var(--err-text)' : 'var(--brand)';
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
              {kpis?.ocupacion_pct ?? 0}%
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
              {kpis?.ocupadas ?? 0}/{kpis?.total ?? 0}
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <ProgressBar
              value={kpis?.ocupacion_pct ?? 0}
              max={100}
              color={color}
            />
          </div>
          <p
            style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)' }}
          >
            {(kpis?.total ?? 0) - (kpis?.ocupadas ?? 0)} plazas libres
          </p>
        </>
      )}
    </div>
  );
}

function KpiIngresosDia({ kpis, loading }: KpiCardsProps) {
  const delta = kpis?.ingresos_dia_delta_pct ?? 0;
  const deltaColor = delta >= 0 ? 'var(--ok-text)' : 'var(--err-text)';
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
            {fmtMoney0(kpis?.ingresos_dia ?? 0)}
          </span>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: deltaColor }}>
            {delta >= 0 ? '+' : ''}
            {delta}% vs. ayer
          </p>
        </>
      )}
    </div>
  );
}

function KpiIngresosMes({ kpis, loading }: KpiCardsProps) {
  return (
    <div className="pk-card pk-card-pad">
      <p className="pk-label" style={{ marginBottom: 12 }}>
        Ingresos del mes
      </p>
      {loading ? (
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
              {fmtMoney0(kpis?.ingresos_mes ?? 0)}
            </span>
            <Sparkline
              data={kpis?.sparkline_data ?? []}
              width={80}
              height={32}
            />
          </div>
          <p
            style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-3)' }}
          >
            Proyectado: {fmtMoney0(kpis?.ingresos_mes_proyectado ?? 0)}
          </p>
        </>
      )}
    </div>
  );
}

export function KpiCards({ kpis, loading }: KpiCardsProps) {
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
      <KpiIngresosMes kpis={kpis} loading={loading} />
    </div>
  );
}
