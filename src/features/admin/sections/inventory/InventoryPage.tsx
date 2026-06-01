import { SUCURSALES } from '../../../../mock/sucursales';
import { Badge } from '../../../../shared/components/ui/Badge';

function totalPlazas(): number {
  return SUCURSALES.reduce((acc, s) => acc + s.total_plazas, 0);
}

export function InventoryPage() {
  return (
    <div className="pk-card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-1)',
            flex: 1,
          }}
        >
          Estacionamientos
        </h2>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {SUCURSALES.length} estacionamientos · {totalPlazas()} plazas
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}
        >
          <thead>
            <tr style={{ background: 'var(--bg-b)' }}>
              {['Estacionamiento', 'Domicilio', 'Total plazas', 'Estado'].map(
                (col) => (
                  <th
                    key={col}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-3)',
                      borderBottom: '1px solid var(--border-soft)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {SUCURSALES.map((s, idx) => (
              <tr
                key={s.id}
                style={{
                  borderBottom:
                    idx < SUCURSALES.length - 1
                      ? '1px solid var(--border-soft)'
                      : 'none',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--bg-b)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                <td style={{ padding: '14px 16px' }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-1)',
                    }}
                  >
                    {s.nombre}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {s.direccion}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--text-1)',
                    }}
                  >
                    {s.total_plazas}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <Badge variant={s.estado === 'active' ? 'ok' : 'warn'} dot>
                    {s.estado === 'active' ? 'Activa' : 'Mantenimiento'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
