import { useState } from 'react';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { fmtMoney0 } from '../../../../shared/utils/fmt';
import { BarChart } from './BarChart';

type Rango = 'Hoy' | '7 días' | '30 días' | '12 meses';
const RANGOS: Rango[] = ['Hoy', '7 días', '30 días', '12 meses'];

interface RangoData {
  labels: string[];
  values: number[];
}

const MOCK_DATA: Record<Rango, RangoData> = {
  Hoy: {
    labels: ['8h', '10h', '12h', '14h', '16h', '18h', '20h', '22h'],
    values: [1200, 3400, 5800, 4200, 6100, 8900, 7200, 3100],
  },
  '7 días': {
    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    values: [28000, 31500, 27400, 33200, 41000, 52000, 38000],
  },
  '30 días': {
    labels: ['S1', 'S2', 'S3', 'S4'],
    values: [180000, 215000, 198000, 242000],
  },
  '12 meses': {
    labels: [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ],
    values: [
      820000, 740000, 890000, 950000, 1020000, 1150000, 980000, 1040000,
      1100000, 1250000, 1180000, 1320000,
    ],
  },
};

interface KpiCardProps {
  title: string;
  value: string;
  sub?: string;
}

function KpiCard({ title, value, sub }: KpiCardProps) {
  return (
    <div
      className="pk-card pk-card-pad"
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-3)',
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: 'var(--text-1)',
          letterSpacing: '-0.02em',
          fontFamily: 'var(--mono)',
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{sub}</span>
      )}
    </div>
  );
}

export function EstadisticasPage() {
  const [rango, setRango] = useState<Rango>('7 días');
  const data = MOCK_DATA[rango];
  const total = data.values.reduce((a, b) => a + b, 0);
  const avg = Math.round(total / data.values.length);
  const txCount = data.values.length * 12 + Math.floor(total / 5000);

  return (
    <div style={{ padding: 32 }}>
      <SectionHeader
        title="Estadísticas"
        subtitle="Ingresos y métricas de operación"
      />

      {/* Range chips */}
      <div
        style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}
      >
        {RANGOS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRango(r)}
            style={{
              padding: '5px 14px',
              borderRadius: 999,
              border: '1px solid',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms',
              borderColor: rango === r ? 'var(--brand)' : 'var(--border)',
              background: rango === r ? 'var(--brand-soft)' : 'transparent',
              color: rango === r ? 'var(--brand)' : 'var(--text-2)',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard
          title="Total ingresos"
          value={fmtMoney0(total)}
          sub={`en el período: ${rango}`}
        />
        <KpiCard title="Promedio" value={fmtMoney0(avg)} sub="por intervalo" />
        <KpiCard
          title="Transacciones"
          value={txCount.toLocaleString('es-AR')}
          sub="estimadas en el período"
        />
      </div>

      {/* Chart */}
      <div className="pk-card pk-card-pad">
        <div style={{ marginBottom: 12 }}>
          <span
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}
          >
            Ingresos por período
          </span>
        </div>
        <BarChart data={data.values} labels={data.labels} height={200} />
      </div>
    </div>
  );
}
