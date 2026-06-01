import { SUCURSALES } from '../../../../mock/sucursales';
import type { Sucursal } from '../../../../types/api';
import { Badge } from '../../../../shared/components/ui/Badge';

interface EmpresaGroup {
  empresa: string;
  sucursales: Sucursal[];
}

// Group SUCURSALES into 4 fictional companies
const EMPRESAS: EmpresaGroup[] = [
  {
    empresa: 'Parking Central S.A.',
    sucursales: SUCURSALES.filter((s) =>
      ['palermo', 'microcentro'].includes(s.id),
    ),
  },
  {
    empresa: 'Cocheras Premium Lat S.A.',
    sucursales: SUCURSALES.filter((s) => ['belgrano', 'nunez'].includes(s.id)),
  },
  {
    empresa: 'Garaje Belgrano',
    sucursales: SUCURSALES.filter((s) => s.id === 'recoleta'),
  },
  {
    empresa: 'Estacionamiento Norte SRL',
    sucursales: [],
  },
];

function totalPlazas(sucursales: Sucursal[]): number {
  return sucursales.reduce((acc, s) => acc + s.total_plazas, 0);
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
          Estacionamientos por empresa
        </h2>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {EMPRESAS.length} empresas
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}
        >
          <thead>
            <tr style={{ background: 'var(--bg-b)' }}>
              {['Empresa', 'Sucursales', 'Total plazas', 'Suscripción'].map(
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
            {EMPRESAS.map((group, idx) => (
              <tr
                key={group.empresa}
                style={{
                  borderBottom:
                    idx < EMPRESAS.length - 1
                      ? '1px solid var(--border-soft)'
                      : 'none',
                  transition: 'background 120ms',
                  verticalAlign: 'top',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--bg-b)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                {/* Empresa */}
                <td style={{ padding: '14px 16px' }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-1)',
                    }}
                  >
                    {group.empresa}
                  </p>
                </td>

                {/* Sucursales list */}
                <td style={{ padding: '14px 16px' }}>
                  {group.sucursales.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Sin sucursales registradas
                    </span>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      {group.sucursales.map((s) => (
                        <div
                          key={s.id}
                          style={{ display: 'flex', flexDirection: 'column' }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              color: 'var(--text-1)',
                              fontWeight: 500,
                            }}
                          >
                            {s.nombre}
                          </span>
                          <span
                            style={{ fontSize: 11, color: 'var(--text-3)' }}
                          >
                            {s.direccion}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>

                {/* Total plazas */}
                <td style={{ padding: '14px 16px' }}>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--text-1)',
                    }}
                  >
                    {totalPlazas(group.sucursales)}
                  </span>
                  {group.sucursales.length > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-3)',
                        display: 'block',
                      }}
                    >
                      en {group.sucursales.length} sucursal
                      {group.sucursales.length !== 1 ? 'es' : ''}
                    </span>
                  )}
                </td>

                {/* Suscripción */}
                <td style={{ padding: '14px 16px' }}>
                  <Badge variant="ok" dot>
                    Activa
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
