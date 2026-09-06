import { useMemo, useState } from 'react';
import { Skeleton } from '../../../../shared/components/ui/Skeleton';
import { EmptyState } from '../../../../shared/components/ui/EmptyState';
import { fmtMoney0 } from '../../../../shared/utils/fmt';
import type { TopPlate, TopPlatesOrderBy } from '../../services/metrics';
import { formatMinutes, sortTopPlates } from './transform';

const ORDER_LABELS: Record<TopPlatesOrderBy, string> = {
  revenue: 'Recaudación',
  visits: 'Visitas',
  duration: 'Tiempo',
};

const ORDERS: TopPlatesOrderBy[] = ['revenue', 'visits', 'duration'];

interface TopPlatesTableProps {
  items: TopPlate[];
  loading?: boolean;
  error?: string | null;
}

const CELL: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text-2)',
  borderBottom: '1px solid var(--border-soft)',
};

const HEAD: React.CSSProperties = {
  ...CELL,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  textAlign: 'left',
};

export function TopPlatesTable({ items, loading, error }: TopPlatesTableProps) {
  const [orderBy, setOrderBy] = useState<TopPlatesOrderBy>('revenue');

  // Las tres métricas vienen siempre en la respuesta, así que reordenar es un
  // sort local: no hace falta volver a pedir.
  const sorted = useMemo(() => sortTopPlates(items, orderBy), [items, orderBy]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
          Top de patentes
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ORDERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setOrderBy(option)}
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                border: '1px solid',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                borderColor:
                  orderBy === option ? 'var(--brand)' : 'var(--border)',
                background:
                  orderBy === option ? 'var(--brand-soft)' : 'transparent',
                color: orderBy === option ? 'var(--brand)' : 'var(--text-2)',
              }}
            >
              {ORDER_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton height={180} />
      ) : error ? (
        <EmptyState title="No se pudo cargar el ranking" description={error} />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="Sin patentes en el período"
          description="Solo se cuentan las estadías que ya terminaron: un vehículo todavía adentro no aparece hasta que se retira."
        />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...HEAD, width: 40 }}>#</th>
                <th style={HEAD}>Patente</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Recaudación</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Visitas</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Tiempo total</th>
                <th style={{ ...HEAD, textAlign: 'right' }}>Promedio</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((plate, index) => (
                <tr key={plate.plate}>
                  <td style={{ ...CELL, color: 'var(--text-3)' }}>
                    {index + 1}
                  </td>
                  <td style={CELL}>
                    <span className="pk-plate">{plate.plate}</span>
                  </td>
                  <td
                    style={{
                      ...CELL,
                      textAlign: 'right',
                      fontFamily: 'var(--mono)',
                      color: 'var(--text-1)',
                    }}
                  >
                    {fmtMoney0(plate.revenue)}
                  </td>
                  <td
                    style={{
                      ...CELL,
                      textAlign: 'right',
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    {plate.visits}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right' }}>
                    {formatMinutes(plate.totalMinutes)}
                  </td>
                  <td style={{ ...CELL, textAlign: 'right' }}>
                    {formatMinutes(plate.averageMinutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
